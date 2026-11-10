import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { ApplicantDocumentStore } from "./documents";
import type { JobPostingStore } from "./job-postings";
import type { ApplicantProfile, ApplicantProfileStore } from "./profile";
import { applications, jobPostings } from "./schema";

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

/** One row of the Applicant's applications list; Job Posting fields are null if the posting is gone. */
export type ApplicationSummary = {
  referenceNumber: string;
  status: ApplicationStatus;
  appliedAt: Date;
  title: string | null;
  department: string | null;
  location: string | null;
  employmentType: string | null;
};

/** What the Application page needs beyond the summary: when the status last changed and what was submitted. */
export type ApplicationSubmissionDetail = {
  updatedAt: Date;
  documents: ApplicationDocument[];
  profile: Pick<ApplicantProfile, "summary" | "skills" | "location">;
};

export type ApplicationStore = {
  findForApplicantAndPosting(applicantId: string, jobPostingId: string): Promise<Application | undefined>;
  insert(application: Omit<Application, "createdAt" | "updatedAt">): Promise<void>;
  listForApplicant(applicantId: string): Promise<Application[]>;
  listSummariesForApplicant(applicantId: string): Promise<ApplicationSummary[]>;
  /** One of the Applicant's own Applications by Reference number; undefined if it doesn't exist or belongs to someone else. */
  findSummaryForApplicant(applicantId: string, referenceNumber: string): Promise<ApplicationSummary | undefined>;
  /** The submitted snapshot of one of the Applicant's own Applications; undefined if it doesn't exist or belongs to someone else. */
  findSubmissionForApplicant(applicantId: string, referenceNumber: string): Promise<ApplicationSubmissionDetail | undefined>;
  /** Application status keyed by Job Posting id, for marking roles already applied to. */
  statusesByPostingForApplicant(applicantId: string): Promise<Record<string, ApplicationStatus>>;
  withdraw(referenceNumber: string, applicantId: string): Promise<ApplicationStatus | undefined>;
  /** Mirrors an HR-ATS Application-status change into the local read-model (ADR-0005). */
  updateStatus(referenceNumber: string, status: ApplicationStatus): Promise<boolean>;
  /** Updates the profile snapshot only while the Application is still `Received`, i.e. not yet Frozen by a status change. */
  updateProfileSnapshotIfReceived(referenceNumber: string, profileSnapshot: ApplicantProfile): Promise<boolean>;
};

const finalApplicationStatuses = new Set(["Hired", "Declined", "Expired", "Rejected", "Withdrawn"]);

function isUniqueViolation(error: unknown, constraintName: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505" &&
    "constraint_name" in error &&
    (error as { constraint_name?: unknown }).constraint_name === constraintName
  );
}

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

function selectSummaries<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(db: PgDatabase<TQueryResult, TSchema>) {
  return db
    .select({
      referenceNumber: applications.referenceNumber,
      status: applications.status,
      appliedAt: applications.createdAt,
      title: jobPostings.title,
      department: jobPostings.department,
      location: jobPostings.location,
      employmentType: jobPostings.employmentType,
    })
    .from(applications)
    .leftJoin(jobPostings, eq(applications.jobPostingId, jobPostings.id));
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
    async listSummariesForApplicant(applicantId) {
      return selectSummaries(db).where(eq(applications.applicantId, applicantId)).orderBy(desc(applications.createdAt));
    },
    async findSummaryForApplicant(applicantId, referenceNumber) {
      const [summary] = await selectSummaries(db)
        .where(and(eq(applications.applicantId, applicantId), eq(applications.referenceNumber, referenceNumber)))
        .limit(1);
      return summary;
    },
    async findSubmissionForApplicant(applicantId, referenceNumber) {
      const [row] = await db
        .select()
        .from(applications)
        .where(and(eq(applications.applicantId, applicantId), eq(applications.referenceNumber, referenceNumber)))
        .limit(1);
      if (!row) return undefined;
      const { summary, skills, location } = asApplication(row).profileSnapshot;
      return { updatedAt: row.updatedAt, documents: asApplication(row).documentsSnapshot, profile: { summary, skills, location } };
    },
    async statusesByPostingForApplicant(applicantId) {
      const rows = await db
        .select({ jobPostingId: applications.jobPostingId, status: applications.status })
        .from(applications)
        .where(eq(applications.applicantId, applicantId));
      return Object.fromEntries(rows.map((row) => [row.jobPostingId, row.status]));
    },
    async withdraw(referenceNumber, applicantId) {
      const [application] = await db.select().from(applications).where(and(eq(applications.referenceNumber, referenceNumber), eq(applications.applicantId, applicantId))).limit(1);
      if (!application) return undefined;
      if (!canWithdrawApplication(application.status)) return application.status;
      await db.update(applications).set({ status: "Withdrawn", updatedAt: new Date() }).where(eq(applications.id, application.id));
      return "Withdrawn";
    },
    async updateStatus(referenceNumber, status) {
      const updated = await db
        .update(applications)
        .set({ status, updatedAt: new Date() })
        .where(eq(applications.referenceNumber, referenceNumber))
        .returning({ id: applications.id });
      return updated.length > 0;
    },
    async updateProfileSnapshotIfReceived(referenceNumber, profileSnapshot) {
      const updated = await db
        .update(applications)
        .set({ profileSnapshot, updatedAt: new Date() })
        .where(and(eq(applications.referenceNumber, referenceNumber), eq(applications.status, "Received")))
        .returning({ id: applications.id });
      return updated.length > 0;
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
  const consentedAt = new Date();
  try {
    await dependencies.applications.insert({
      applicantId: dependencies.identity.userId,
      jobPostingId: posting.id,
      referenceNumber,
      status: "Received",
      profileSnapshot: profile,
      documentsSnapshot: selectedDocuments as ApplicationDocument[],
      consentedAt,
    });
  } catch (error) {
    if (isUniqueViolation(error, "applications_applicant_posting_unique")) throw new Error("You have already applied to this Job Posting.");
    throw error;
  }
  try {
    await dependencies.sendConfirmationEmail(dependencies.identity.email, { referenceNumber, jobTitle: posting.title });
    return { referenceNumber, confirmationEmailSent: true };
  } catch {
    return { referenceNumber, confirmationEmailSent: false };
  }
}

/** An Application is Frozen once HR-ATS marks its status past `Received`, or its Job Posting's deadline passes, whichever happens first (ADR-0005). */
export function isApplicationFrozen(status: ApplicationStatus, jobPostingDeadline: Date, now: Date = new Date()) {
  return status !== "Received" || jobPostingDeadline <= now;
}

type ProfileSyncDependencies = {
  applications: Pick<ApplicationStore, "listForApplicant" | "updateProfileSnapshotIfReceived">;
  postings: Pick<JobPostingStore, "findById">;
};

/** Carries a base-profile edit into every one of the Applicant's still-unfrozen Application snapshots; Frozen Applications are left untouched. */
export async function syncApplicationProfileSnapshots(applicantId: string, profile: ApplicantProfile, dependencies: ProfileSyncDependencies) {
  const applicantApplications = await dependencies.applications.listForApplicant(applicantId);
  for (const application of applicantApplications) {
    const posting = application.status === "Received" ? await dependencies.postings.findById(application.jobPostingId) : undefined;
    if (!posting || isApplicationFrozen(application.status, posting.deadline)) continue;
    await dependencies.applications.updateProfileSnapshotIfReceived(application.referenceNumber, profile);
  }
}

export async function withdrawApplication(
  referenceNumber: string,
  store: ApplicationStore,
  applicantId: string,
) {
  const status = await store.withdraw(referenceNumber, applicantId);
  if (!status) throw new Error("Application not found.");
  if (status !== "Withdrawn") throw new Error("This Application has reached a final status and cannot be withdrawn.");
  return { status };
}
