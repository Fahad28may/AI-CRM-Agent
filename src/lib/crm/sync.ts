import { db } from "@/lib/db";
import { getProviderForConnection } from "@/lib/crm/connection";
import type { CRMConnection } from "@/generated/prisma/client";
import type { CRMProvider, ListOptions } from "@/lib/crm/types";

/** In-run cache of externalId -> internal id, falling back to a DB lookup for records this run didn't touch. */
class IdResolver {
  private cache = new Map<string, string>();

  constructor(
    private lookup: (externalId: string) => Promise<{ id: string } | null>,
  ) {}

  set(externalId: string, internalId: string) {
    this.cache.set(externalId, internalId);
  }

  async resolve(externalId: string | null): Promise<string | null> {
    if (!externalId) return null;
    const cached = this.cache.get(externalId);
    if (cached) return cached;
    const record = await this.lookup(externalId);
    if (record) this.cache.set(externalId, record.id);
    return record?.id ?? null;
  }
}

async function syncCompanies(
  provider: CRMProvider,
  workspaceId: string,
  crmConnectionId: string,
  options: ListOptions,
  resolver: IdResolver,
) {
  let cursor = options.cursor ?? null;
  do {
    const page = await provider.getCompanies({ cursor, modifiedSince: options.modifiedSince });
    for (const c of page.items) {
      const row = await db.company.upsert({
        where: {
          workspaceId_crmConnectionId_externalId: {
            workspaceId,
            crmConnectionId,
            externalId: c.externalId,
          },
        },
        create: {
          workspaceId,
          crmConnectionId,
          externalId: c.externalId,
          name: c.name,
          domain: c.domain,
          industry: c.industry,
          crmCreatedAt: c.crmCreatedAt,
          crmUpdatedAt: c.crmUpdatedAt,
        },
        update: {
          name: c.name,
          domain: c.domain,
          industry: c.industry,
          crmUpdatedAt: c.crmUpdatedAt,
        },
      });
      resolver.set(c.externalId, row.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
}

async function syncContacts(
  provider: CRMProvider,
  workspaceId: string,
  crmConnectionId: string,
  options: ListOptions,
  contactResolver: IdResolver,
  companyResolver: IdResolver,
) {
  let cursor = options.cursor ?? null;
  do {
    const page = await provider.getContacts({ cursor, modifiedSince: options.modifiedSince });
    for (const c of page.items) {
      const companyId = await companyResolver.resolve(c.companyExternalId);
      const row = await db.contact.upsert({
        where: {
          workspaceId_crmConnectionId_externalId: {
            workspaceId,
            crmConnectionId,
            externalId: c.externalId,
          },
        },
        create: {
          workspaceId,
          crmConnectionId,
          externalId: c.externalId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          jobTitle: c.jobTitle,
          companyId,
          ownerExternalId: c.ownerExternalId,
          crmCreatedAt: c.crmCreatedAt,
          crmUpdatedAt: c.crmUpdatedAt,
        },
        update: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          jobTitle: c.jobTitle,
          companyId,
          ownerExternalId: c.ownerExternalId,
          crmUpdatedAt: c.crmUpdatedAt,
        },
      });
      contactResolver.set(c.externalId, row.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
}

async function syncDeals(
  provider: CRMProvider,
  workspaceId: string,
  crmConnectionId: string,
  options: ListOptions,
  dealResolver: IdResolver,
  contactResolver: IdResolver,
  companyResolver: IdResolver,
) {
  let cursor = options.cursor ?? null;
  do {
    const page = await provider.getDeals({ cursor, modifiedSince: options.modifiedSince });
    for (const d of page.items) {
      const [contactId, companyId, existing] = await Promise.all([
        contactResolver.resolve(d.contactExternalId),
        companyResolver.resolve(d.companyExternalId),
        db.deal.findUnique({
          where: {
            workspaceId_crmConnectionId_externalId: {
              workspaceId,
              crmConnectionId,
              externalId: d.externalId,
            },
          },
          select: { stage: true },
        }),
      ]);
      // Only bump stageChangedAt when the stage actually moved — an
      // unconditional `now()` on every sync would make every deal look
      // like it just changed stage, defeating stagnation detection.
      const stageChanged = !existing || existing.stage !== d.stage;
      const row = await db.deal.upsert({
        where: {
          workspaceId_crmConnectionId_externalId: {
            workspaceId,
            crmConnectionId,
            externalId: d.externalId,
          },
        },
        create: {
          workspaceId,
          crmConnectionId,
          externalId: d.externalId,
          name: d.name,
          amount: d.amount,
          stage: d.stage,
          pipeline: d.pipeline,
          ownerExternalId: d.ownerExternalId,
          contactId,
          companyId,
          closeDate: d.closeDate,
          isClosed: d.isClosed,
          isWon: d.isWon,
          stageChangedAt: d.crmCreatedAt ?? new Date(),
          crmCreatedAt: d.crmCreatedAt,
          crmUpdatedAt: d.crmUpdatedAt,
        },
        update: {
          name: d.name,
          amount: d.amount,
          stage: d.stage,
          pipeline: d.pipeline,
          ownerExternalId: d.ownerExternalId,
          contactId,
          companyId,
          closeDate: d.closeDate,
          isClosed: d.isClosed,
          isWon: d.isWon,
          ...(stageChanged && { stageChangedAt: new Date() }),
          crmUpdatedAt: d.crmUpdatedAt,
        },
      });
      dealResolver.set(d.externalId, row.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
}

async function syncActivities(
  provider: CRMProvider,
  workspaceId: string,
  crmConnectionId: string,
  options: ListOptions,
  dealResolver: IdResolver,
  contactResolver: IdResolver,
  companyResolver: IdResolver,
) {
  let cursor = options.cursor ?? null;
  do {
    const page = await provider.getActivities({ cursor, modifiedSince: options.modifiedSince });
    for (const a of page.items) {
      const [dealId, contactId, companyId] = await Promise.all([
        dealResolver.resolve(a.dealExternalId),
        contactResolver.resolve(a.contactExternalId),
        companyResolver.resolve(a.companyExternalId),
      ]);
      await db.activity.upsert({
        where: {
          workspaceId_crmConnectionId_type_externalId: {
            workspaceId,
            crmConnectionId,
            type: a.type,
            externalId: a.externalId,
          },
        },
        create: {
          workspaceId,
          crmConnectionId,
          externalId: a.externalId,
          type: a.type,
          subject: a.subject,
          body: a.body,
          ownerExternalId: a.ownerExternalId,
          dealId,
          contactId,
          companyId,
          occurredAt: a.occurredAt,
        },
        update: {
          subject: a.subject,
          body: a.body,
          ownerExternalId: a.ownerExternalId,
          dealId,
          contactId,
          companyId,
          occurredAt: a.occurredAt,
        },
      });

      if (dealId) {
        await db.deal.update({
          where: { id: dealId },
          data: { lastActivityAt: a.occurredAt },
        }).catch(() => {
          // Best-effort — a concurrent sync or deletion racing this update
          // shouldn't fail the whole activity sync.
        });
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
}

function makeResolver(
  model: { findUnique(args: unknown): Promise<{ id: string } | null> },
  workspaceId: string,
  crmConnectionId: string,
) {
  return new IdResolver((externalId) =>
    model.findUnique({
      where: {
        workspaceId_crmConnectionId_externalId: { workspaceId, crmConnectionId, externalId },
      },
      select: { id: true },
    }),
  );
}

/**
 * Syncs one CRM connection end to end: companies, then contacts (which
 * reference companies), then deals (which reference both), then
 * activities (which reference all three). Incremental after the first
 * run — only fetches records modified since the connection's
 * lastSyncedAt. Safe to re-run: every write is an upsert keyed by the
 * CRM's own record id, so a retried or overlapping sync can't duplicate
 * data.
 */
export async function syncCrmConnection(connectionId: string): Promise<void> {
  const connection = await db.cRMConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const provider = await getProviderForConnection(connection);
  const { workspaceId } = connection;
  const modifiedSince = connection.lastSyncedAt;
  const startedAt = new Date();

  const companyResolver = makeResolver(db.company, workspaceId, connectionId);
  const contactResolver = makeResolver(db.contact, workspaceId, connectionId);
  const dealResolver = makeResolver(db.deal, workspaceId, connectionId);

  try {
    await syncCompanies(provider, workspaceId, connectionId, { modifiedSince }, companyResolver);
    await syncContacts(
      provider,
      workspaceId,
      connectionId,
      { modifiedSince },
      contactResolver,
      companyResolver,
    );
    await syncDeals(
      provider,
      workspaceId,
      connectionId,
      { modifiedSince },
      dealResolver,
      contactResolver,
      companyResolver,
    );
    await syncActivities(
      provider,
      workspaceId,
      connectionId,
      { modifiedSince },
      dealResolver,
      contactResolver,
      companyResolver,
    );

    await db.cRMConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: startedAt, lastSyncError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await db.cRMConnection.update({
      where: { id: connectionId },
      data: { lastSyncError: message },
    });
    throw error;
  }
}

export function reconnectCrmConnection(connection: Pick<CRMConnection, "id">) {
  return syncCrmConnection(connection.id);
}
