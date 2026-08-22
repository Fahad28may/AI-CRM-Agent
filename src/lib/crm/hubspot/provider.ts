import { HubSpotApiError, HubSpotClient } from "./client";
import type {
  ActivityType,
  CRMProvider,
  CreateTaskInput,
  ListOptions,
  NormalizedActivity,
  NormalizedCompany,
  NormalizedContact,
  NormalizedDeal,
  NormalizedOwner,
  Page,
  UpdateContactInput,
  UpdateDealInput,
} from "@/lib/crm/types";

type HubSpotRecord = {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
};

type HubSpotListResponse = {
  results: HubSpotRecord[];
  paging?: { next?: { after: string } };
};

const PAGE_SIZE = "100";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toBool(value: string | null | undefined): boolean {
  return value === "true";
}

function firstAssociation(record: HubSpotRecord, type: string): string | null {
  return record.associations?.[type]?.results?.[0]?.id ?? null;
}

/** Object-type-specific config: which properties to fetch and which field carries last-modified. */
const OBJECT_CONFIG = {
  contacts: {
    properties: ["firstname", "lastname", "email", "phone", "jobtitle", "hubspot_owner_id"],
    lastModifiedProperty: "lastmodifieddate",
    associations: "companies",
  },
  companies: {
    properties: ["name", "domain", "industry"],
    lastModifiedProperty: "hs_lastmodifieddate",
    associations: undefined,
  },
  deals: {
    properties: [
      "dealname",
      "amount",
      "dealstage",
      "pipeline",
      "closedate",
      "hs_is_closed",
      "hs_is_closed_won",
      "hubspot_owner_id",
    ],
    lastModifiedProperty: "hs_lastmodifieddate",
    associations: "contacts,companies",
  },
} as const;

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { objectType: string; properties: string[]; subjectProperty: string; bodyProperty: string }
> = {
  CALL: {
    objectType: "calls",
    properties: ["hs_call_title", "hs_call_body", "hs_timestamp", "hubspot_owner_id"],
    subjectProperty: "hs_call_title",
    bodyProperty: "hs_call_body",
  },
  EMAIL: {
    objectType: "emails",
    properties: ["hs_email_subject", "hs_email_text", "hs_timestamp", "hubspot_owner_id"],
    subjectProperty: "hs_email_subject",
    bodyProperty: "hs_email_text",
  },
  MEETING: {
    objectType: "meetings",
    properties: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp", "hubspot_owner_id"],
    subjectProperty: "hs_meeting_title",
    bodyProperty: "hs_meeting_body",
  },
  NOTE: {
    objectType: "notes",
    properties: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
    subjectProperty: "hs_note_body",
    bodyProperty: "hs_note_body",
  },
  TASK: {
    objectType: "tasks",
    properties: ["hs_task_subject", "hs_task_body", "hs_timestamp", "hubspot_owner_id"],
    subjectProperty: "hs_task_subject",
    bodyProperty: "hs_task_body",
  },
};

export class HubSpotProvider implements CRMProvider {
  private client: HubSpotClient;

  constructor(accessToken: string) {
    this.client = new HubSpotClient(accessToken);
  }

  private async listRecords(
    objectType: string,
    properties: readonly string[],
    associations: string | undefined,
    lastModifiedProperty: string,
    options: ListOptions,
  ): Promise<Page<HubSpotRecord>> {
    if (options.modifiedSince) {
      // The Search API silently ignores an `associations` field in the
      // request body (HubSpot documents this: associations are only
      // supported on GET-by-id and batch read, not search) — so every
      // incremental sync would otherwise lose contact/company/deal links
      // on any record touched after the first full sync. Fetch them in a
      // second pass instead.
      const response = await this.client.post<HubSpotListResponse>(
        `/crm/v3/objects/${objectType}/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: lastModifiedProperty,
                  operator: "GT",
                  value: String(options.modifiedSince.getTime()),
                },
              ],
            },
          ],
          sorts: [{ propertyName: lastModifiedProperty, direction: "ASCENDING" }],
          properties,
          limit: 100,
          after: options.cursor ?? undefined,
        },
      );
      if (associations) {
        await this.attachAssociations(objectType, response.results, associations);
      }
      return { items: response.results, nextCursor: response.paging?.next?.after ?? null };
    }

    const response = await this.client.get<HubSpotListResponse>(`/crm/v3/objects/${objectType}`, {
      limit: PAGE_SIZE,
      properties: properties.join(","),
      associations,
      after: options.cursor ?? undefined,
    });
    return { items: response.results, nextCursor: response.paging?.next?.after ?? null };
  }

  /** Batch-fetches associations for a page of search results and merges them onto each record, in place. */
  private async attachAssociations(
    fromObjectType: string,
    records: HubSpotRecord[],
    associations: string,
  ): Promise<void> {
    if (records.length === 0) return;

    for (const toObjectType of associations.split(",")) {
      const response = await this.client.post<{
        results: { from: { id: string }; to: { toObjectId: number | string }[] }[];
      }>(`/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`, {
        inputs: records.map((r) => ({ id: r.id })),
      });

      const byFromId = new Map(response.results.map((r) => [r.from.id, r.to]));
      for (const record of records) {
        const to = byFromId.get(record.id);
        if (!to || to.length === 0) continue;
        record.associations = record.associations ?? {};
        record.associations[toObjectType] = {
          results: to.map((t) => ({ id: String(t.toObjectId), type: "" })),
        };
      }
    }
  }

  async getContacts(options: ListOptions): Promise<Page<NormalizedContact>> {
    const config = OBJECT_CONFIG.contacts;
    const page = await this.listRecords(
      "contacts",
      config.properties,
      config.associations,
      config.lastModifiedProperty,
      options,
    );
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((r) => ({
        externalId: r.id,
        firstName: r.properties.firstname,
        lastName: r.properties.lastname,
        email: r.properties.email,
        phone: r.properties.phone,
        jobTitle: r.properties.jobtitle,
        companyExternalId: firstAssociation(r, "companies"),
        ownerExternalId: r.properties.hubspot_owner_id,
        crmCreatedAt: toDate(r.createdAt),
        crmUpdatedAt: toDate(r.updatedAt),
      })),
    };
  }

  async getCompanies(options: ListOptions): Promise<Page<NormalizedCompany>> {
    const config = OBJECT_CONFIG.companies;
    const page = await this.listRecords(
      "companies",
      config.properties,
      config.associations,
      config.lastModifiedProperty,
      options,
    );
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((r) => ({
        externalId: r.id,
        name: r.properties.name,
        domain: r.properties.domain,
        industry: r.properties.industry,
        crmCreatedAt: toDate(r.createdAt),
        crmUpdatedAt: toDate(r.updatedAt),
      })),
    };
  }

  async getDeals(options: ListOptions): Promise<Page<NormalizedDeal>> {
    const config = OBJECT_CONFIG.deals;
    const page = await this.listRecords(
      "deals",
      config.properties,
      config.associations,
      config.lastModifiedProperty,
      options,
    );
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((r) => ({
        externalId: r.id,
        name: r.properties.dealname,
        amount: toNumber(r.properties.amount),
        stage: r.properties.dealstage,
        pipeline: r.properties.pipeline,
        ownerExternalId: r.properties.hubspot_owner_id,
        contactExternalId: firstAssociation(r, "contacts"),
        companyExternalId: firstAssociation(r, "companies"),
        closeDate: toDate(r.properties.closedate),
        isClosed: toBool(r.properties.hs_is_closed),
        isWon: r.properties.hs_is_closed_won ? toBool(r.properties.hs_is_closed_won) : null,
        crmCreatedAt: toDate(r.createdAt),
        crmUpdatedAt: toDate(r.updatedAt),
      })),
    };
  }

  async getActivities(options: ListOptions): Promise<Page<NormalizedActivity>> {
    // HubSpot models each engagement type as its own object. We fan out
    // across all five and merge, tracking a compound cursor per type.
    const cursors: Record<string, string | null> = options.cursor
      ? JSON.parse(options.cursor)
      : {};
    const items: NormalizedActivity[] = [];
    const nextCursors: Record<string, string> = {};

    for (const [type, config] of Object.entries(ACTIVITY_CONFIG) as [
      ActivityType,
      (typeof ACTIVITY_CONFIG)[ActivityType],
    ][]) {
      const cursor = cursors[type] ?? null;
      // Once a type's pagination is exhausted for this run, skip it —
      // absence of a cursor key means "start from the top" only on the
      // very first page.
      if (options.cursor && !(type in cursors)) continue;

      let page: Page<HubSpotRecord>;
      try {
        page = await this.listRecords(
          config.objectType,
          [...config.properties, "hs_object_id"],
          "contacts,deals,companies",
          "hs_timestamp",
          { cursor, modifiedSince: options.modifiedSince },
        );
      } catch (error) {
        // Some engagement types (notably emails) require scopes beyond
        // the standard crm.objects.contacts/deals/companies set on some
        // accounts, and HubSpot's own scope docs for that endpoint are
        // unreliable about which scope actually works. Rather than fail
        // the whole sync over one inaccessible engagement type, skip it
        // and keep going — contacts/companies/deals and the other
        // activity types still sync normally.
        if (error instanceof HubSpotApiError && error.status === 403) continue;
        throw error;
      }

      for (const r of page.items) {
        const occurredAt = toDate(r.properties.hs_timestamp) ?? new Date();
        items.push({
          externalId: r.id,
          type,
          subject: type === "NOTE" ? null : r.properties[config.subjectProperty],
          body: r.properties[config.bodyProperty],
          ownerExternalId: r.properties.hubspot_owner_id,
          dealExternalId: firstAssociation(r, "deals"),
          contactExternalId: firstAssociation(r, "contacts"),
          companyExternalId: firstAssociation(r, "companies"),
          occurredAt,
        });
      }
      if (page.nextCursor) nextCursors[type] = page.nextCursor;
    }

    return {
      items,
      nextCursor: Object.keys(nextCursors).length > 0 ? JSON.stringify(nextCursors) : null,
    };
  }

  async getOwners(): Promise<NormalizedOwner[]> {
    const owners: NormalizedOwner[] = [];
    let after: string | undefined;
    do {
      const response = await this.client.get<{
        results: { id: string; email?: string; firstName?: string; lastName?: string }[];
        paging?: { next?: { after: string } };
      }>("/crm/v3/owners", { limit: PAGE_SIZE, after });
      owners.push(
        ...response.results.map((o) => ({
          externalId: o.id,
          email: o.email ?? null,
          firstName: o.firstName ?? null,
          lastName: o.lastName ?? null,
        })),
      );
      after = response.paging?.next?.after;
    } while (after);
    return owners;
  }

  async updateContact(externalId: string, input: UpdateContactInput): Promise<void> {
    await this.client.patch(`/crm/v3/objects/contacts/${externalId}`, {
      properties: {
        ...(input.email !== undefined && { email: input.email }),
        ...(input.firstName !== undefined && { firstname: input.firstName }),
        ...(input.lastName !== undefined && { lastname: input.lastName }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.jobTitle !== undefined && { jobtitle: input.jobTitle }),
      },
    });
  }

  async updateDeal(externalId: string, input: UpdateDealInput): Promise<void> {
    await this.client.patch(`/crm/v3/objects/deals/${externalId}`, {
      properties: {
        ...(input.stage !== undefined && { dealstage: input.stage }),
        ...(input.amount !== undefined && { amount: String(input.amount) }),
        ...(input.closeDate !== undefined && {
          closedate: input.closeDate.toISOString(),
        }),
      },
    });
  }

  async createTask(input: CreateTaskInput): Promise<{ externalId: string }> {
    const created = await this.client.post<{ id: string }>("/crm/v3/objects/tasks", {
      properties: {
        hs_task_subject: input.subject,
        hs_task_body: input.body ?? "",
        hs_timestamp: input.dueAt.getTime(),
        hs_task_status: "NOT_STARTED",
      },
    });

    // The v3 "default association" shortcut only works for a handful of
    // hardcoded object-type pairs and 400s ("Unable to infer object type
    // from: default") for tasks — confirmed against a live account.
    // v4 supports it generically for any pair.
    if (input.associateWithContactExternalId) {
      await this.client.put(
        `/crm/v4/objects/tasks/${created.id}/associations/default/contacts/${input.associateWithContactExternalId}`,
      );
    }
    if (input.associateWithDealExternalId) {
      await this.client.put(
        `/crm/v4/objects/tasks/${created.id}/associations/default/deals/${input.associateWithDealExternalId}`,
      );
    }

    return { externalId: created.id };
  }
}
