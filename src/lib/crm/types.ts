/**
 * Provider-agnostic shapes. HubSpot today; a future Salesforce/Pipedrive/
 * Zoho provider maps its own API responses into these same shapes so the
 * rest of the app (sync, pipeline health, AI) never deals with a specific
 * CRM's schema.
 */

export type NormalizedContact = {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  companyExternalId: string | null;
  ownerExternalId: string | null;
  crmCreatedAt: Date | null;
  crmUpdatedAt: Date | null;
};

export type NormalizedCompany = {
  externalId: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  crmCreatedAt: Date | null;
  crmUpdatedAt: Date | null;
};

export type NormalizedDeal = {
  externalId: string;
  name: string | null;
  amount: number | null;
  stage: string | null;
  pipeline: string | null;
  ownerExternalId: string | null;
  contactExternalId: string | null;
  companyExternalId: string | null;
  closeDate: Date | null;
  isClosed: boolean;
  isWon: boolean | null;
  crmCreatedAt: Date | null;
  crmUpdatedAt: Date | null;
};

export type ActivityType = "EMAIL" | "CALL" | "MEETING" | "NOTE" | "TASK";

export type NormalizedActivity = {
  externalId: string;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  ownerExternalId: string | null;
  dealExternalId: string | null;
  contactExternalId: string | null;
  companyExternalId: string | null;
  occurredAt: Date;
};

export type NormalizedOwner = {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ListOptions = {
  cursor?: string | null;
  /** Only return records modified after this time — omit for a full sync. */
  modifiedSince?: Date | null;
};

export type CreateTaskInput = {
  subject: string;
  body?: string;
  dueAt: Date;
  associateWithContactExternalId?: string;
  associateWithDealExternalId?: string;
};

export type UpdateContactInput = Partial<{
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
}>;

export type UpdateDealInput = Partial<{
  stage: string;
  amount: number;
  closeDate: Date;
}>;

/**
 * The abstraction the rest of the app talks to. See docs/Master Prompt —
 * AI CRM Agent SaaS.md section 6.
 */
export interface CRMProvider {
  getContacts(options: ListOptions): Promise<Page<NormalizedContact>>;
  getCompanies(options: ListOptions): Promise<Page<NormalizedCompany>>;
  getDeals(options: ListOptions): Promise<Page<NormalizedDeal>>;
  getActivities(options: ListOptions): Promise<Page<NormalizedActivity>>;
  getOwners(): Promise<NormalizedOwner[]>;
  updateContact(externalId: string, input: UpdateContactInput): Promise<void>;
  updateDeal(externalId: string, input: UpdateDealInput): Promise<void>;
  createTask(input: CreateTaskInput): Promise<{ externalId: string }>;
}
