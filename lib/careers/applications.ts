import { and, asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { ApplicantDocumentStore } from "./documents";
import type { JobPostingStore } from "./job-postings";
import type { ApplicantProfile, ApplicantProfileStore } from "./profile";
import { applications } from "./schema";

export type ApplicationStatus = "Received" | "Withdrawn" | "Hired" | "Declined" | "Expired" | "Rejected" | string;
export type ApplicationDocument = { id: number; name: string; contentType: string; size: number; requiredFor: string };
export type Application = {
  applicantId: string;
  jobPostingId: string;
  referenceNumber: string;
  status: ApplicationStatus;
  profileSnapshot: ApplicantProfile;
  documentsSnapshot: ApplicationDocument[];
  consentedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplicationStore = {
  findForApplicantAndPosting(applicantId: string, jobPostingId: string): Promise<Application | undefined>;
  insert(application: Omit<Application, "createdAt" | "updatedAt">): Promise<void>;
  listForApplicant(applicantId: string): Promise<Application[]>;
  withdraw(referenceNumber: string, applicantId: string): Promise<ApplicationStatus | undefined>;
};

const finalApplicationStatuses = new Set(["Hired", "Declined", "Expired", "Rejected", "Withdrawn"]);

export function canWithdrawApplication(status: ApplicationStatus) {
  return !finalApplicationStatuses.has(status);
}

function asApplication(row: typeof applications.$inferSelect): Application {
  return {
    applicantId: row.applicantId,
    jobPostingId: row.jobPostingId,
    referenceNumber: row.referenceNumber,
    status: row.status,
    profileSnapshot: row.profileSnapshot as ApplicantProfile,
    documentsSnapshot: row.documentsSnapshot as ApplicationDocument[],
    consentedAt: row.consentedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createApplicationStore<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(db: PgDatabase<TQueryResult, TSchema>): ApplicationStore {
  return {
    async findForApplicantAndPosting(applicantId, jobPostingId) {
      const [application] = await db.select().from(applications).where(and(eq(applications.applicantId, applicantId), eq(applications.jobPostingId, jobPostingId))).limit(1);
      return application && asApplication(application);
    },
    async insert(application) {
      await db.insert(applications).values(application);
    },
    async listForApplicant(applicantId) {
      const rows = await db.select().from(applications).where(eq(applications.applicantId, applicantId)).orderBy(asc(applications.createdAt));
      return rows.map(asApplication);
    },
    async withdraw(referenceNumber, applicantId) {
      const [application] = await db.select().from(applications).where(and(eq(applications.referenceNumber, referenceNumber), eq(applications.applicantId, applicantId))).limit(1);
      if (!application) return undefined;
      if (!canWithdrawApplication(application.status)) return application.status;
      await db.update(applications).set({ status: "Withdrawn", updatedAt: new Date() }).where(eq(applications.id, application.id));
      return "Withdrawn";
    },
  };
}

type ApplicantIdentity = { userId: string; email: string; verified: boolean };
type SubmissionDependencies = {
  identity: ApplicantIdentity;
  profile: Pick<ApplicantProfileStore, "find">;
  documents: Pick<ApplicantDocumentStore, "list">;
  postings: Pick<JobPostingStore, "findOpen">;
  applications: ApplicationStore;
  makeReferenceNumber(): string;
  sendConfirmationEmail(recipient: string, application: { referenceNumber: string; jobTitle: string }): Promise<void>;
};

export async function submitApplication(input: { jobPostingId: string; documentIds: number[]; consent: boolean }, dependencies: SubmissionDependencies) {
  if (!dependencies.identity.verified) throw new Error("Verify your email before applying.");
  const [profile, posting, availableDocuments, existing] = await Promise.all([
    dependencies.profile.find(dependencies.identity.userId),
    dependencies.postings.findOpen(input.jobPostingId),
    dependencies.documents.list(dependencies.identity.userId),
    dependencies.applications.findForApplicantAndPosting(dependencies.identity.userId, input.jobPostingId),
  ]);
  if (!profile) throw new Error("Complete your Applicant profile before applying.");
  if (!posting) throw new Error("This Job Posting is no longer open.");
  if (existing) throw new Error("You have already applied to this Job Posting.");
  if (!input.consent) throw new Error("Consent to the data-privacy notice before submitting.");
  if (input.documentIds.length !== posting.requiredDocuments.length || new Set(input.documentIds).size !== input.documentIds.length) throw new Error("Select a Document for every required document.");
  const selectedDocuments = input.documentIds.map((id, index) => {
    const document = availableDocuments.find((availableDocument) => availableDocument.id === id);
    return document && { ...document, requiredFor: posting.requiredDocuments[index] };
  });
  if (selectedDocuments.some((document) => !document)) throw new Error("Select a Document from your Applicant profile.");

  const referenceNumber = dependencies.makeReferenceNumber();
  await dependencies.applications.insert({
    applicantId: dependencies.identity.userId,
    jobPostingId: posting.id,
    referenceNumber,
    status: "Received",
    profileSnapshot: profile,
    documentsSnapshot: selectedDocuments as ApplicationDocument[],
    consentedAt: new Date(),
  });
  try {
    await dependencies.sendConfirmationEmail(dependencies.identity.email, { referenceNumber, jobTitle: posting.title });
    return { referenceNumber, confirmationEmailSent: true };
  } catch {
    return { referenceNumber, confirmationEmailSent: false };
  }
}

export async function withdrawApplication(referenceNumber: string, store: ApplicationStore, applicantId: string) {
  const status = await store.withdraw(referenceNumber, applicantId);
  if (!status) throw new Error("Application not found.");
  if (status !== "Withdrawn") throw new Error("This Application has reached a final status and cannot be withdrawn.");
  return { status };
}
