import { boolean, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

// Careers is the sole migration owner of the shared brenraphaels-ats database.
// HRMS writes Job Postings and Job Templates; it never migrates these tables.
// applicantId is an opaque id from Careers' Neon Auth instance, never a
// foreign key to neon_auth because application migrations do not manage it.
export const applicantProfiles = pgTable("applicant_profiles", {
  applicantId: text("applicant_id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  location: text("location"),
  summary: text("summary"),
  skills: text("skills").notNull().default(""),
  jobAlertsOptIn: boolean("job_alerts_opt_in").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicantEducation = pgTable("applicant_education", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicantId: text("applicant_id").notNull().references(() => applicantProfiles.applicantId, { onDelete: "cascade" }),
  school: text("school").notNull(), qualification: text("qualification").notNull(),
  fieldOfStudy: text("field_of_study"), startedOn: text("started_on"), completedOn: text("completed_on"),
});

export const applicantWorkHistory = pgTable("applicant_work_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicantId: text("applicant_id").notNull().references(() => applicantProfiles.applicantId, { onDelete: "cascade" }),
  employer: text("employer").notNull(), title: text("title").notNull(),
  startedOn: text("started_on"), endedOn: text("ended_on"), description: text("description"),
});

export const applicantDocuments = pgTable("applicant_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicantId: text("applicant_id").notNull().references(() => applicantProfiles.applicantId, { onDelete: "cascade" }),
  name: text("name").notNull(), contentType: text("content_type").notNull(), size: integer("size").notNull(), blobPathname: text("blob_pathname").notNull().unique(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Job Postings authored directly by HRMS in the shared database. */
export const jobPostings = pgTable("job_postings", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  employmentType: text("employment_type").notNull(),
  location: text("location").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  requiredDocuments: jsonb("required_documents").$type<string[]>().notNull(),
  screeningCriteria: jsonb("screening_criteria").$type<string[]>().notNull(),
  status: text("status").notNull(),
  announcedAt: timestamp("announced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Explicitly saved by HRMS; copying a template keeps no link to the source. */
export const jobTemplates = pgTable("job_templates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  employmentType: text("employment_type").notNull(),
  location: text("location").notNull(),
  requiredDocuments: jsonb("required_documents").$type<string[]>().notNull(),
  screeningCriteria: jsonb("screening_criteria").$type<string[]>().notNull(),
  status: text("status").notNull(),
  announcedAt: timestamp("announced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A local, immutable-at-submission record sent to HR-ATS asynchronously later. */
export const applications = pgTable("applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  applicantId: text("applicant_id").notNull().references(() => applicantProfiles.applicantId, { onDelete: "cascade" }),
  jobPostingId: text("job_posting_id").notNull(),
  referenceNumber: text("reference_number").notNull().unique(),
  status: text("status").notNull(),
  profileSnapshot: jsonb("profile_snapshot").$type<unknown>().notNull(),
  documentsSnapshot: jsonb("documents_snapshot").$type<unknown>().notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("applications_applicant_posting_unique").on(table.applicantId, table.jobPostingId),
]);
