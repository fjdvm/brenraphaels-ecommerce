import { and, asc, eq, gt } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { jobPostings } from "./schema";

export type JobPosting = {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string;
  employmentType: string;
  location: string;
  deadline: Date;
  requiredDocuments: string[];
  screeningCriteria: string[];
};

type JobPostingPayload = Omit<JobPosting, "deadline"> & {
  deadline: string;
  status: "draft" | "open" | "closed" | "filled";
};

export type JobPostingEvent = {
  event: "job_posting.created" | "job_posting.updated" | "job_posting.closed";
  data: JobPostingPayload;
};

export type JobPostingStore = {
  applyEvent(event: JobPostingEvent): Promise<void>;
  listOpen(filters?: JobPostingFilters): Promise<JobPosting[]>;
  listOpenFilterOptions(): Promise<JobPostingFilterOptions>;
  findOpen(id: string): Promise<JobPosting | undefined>;
  findById(id: string): Promise<JobPosting | undefined>;
};

export type JobPostingFilters = {
  department?: string;
  employmentType?: string;
  location?: string;
};

export type JobPostingFilterOptions = {
  departments: string[];
  employmentTypes: string[];
  locations: string[];
};

function asJobPosting(posting: typeof jobPostings.$inferSelect): JobPosting {
  return {
    id: posting.id,
    title: posting.title,
    department: posting.department,
    description: posting.description,
    requirements: posting.requirements,
    employmentType: posting.employmentType,
    location: posting.location,
    deadline: posting.deadline,
    requiredDocuments: posting.requiredDocuments,
    screeningCriteria: posting.screeningCriteria,
  };
}

/** Keeps the public careers pages independent from HR-ATS availability. */
export function createJobPostingStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): JobPostingStore {
  return {
    async applyEvent({ event, data }) {
      const status = event === "job_posting.closed" ? "closed" : data.status;
      const values = { ...data, deadline: new Date(data.deadline), status, updatedAt: new Date() };
      await db
        .insert(jobPostings)
        .values(values)
        .onConflictDoUpdate({
          target: jobPostings.id,
          set: values,
        });
    },

    async listOpen(filters = {}) {
      const conditions = openPostingConditions();
      if (filters.department) conditions.push(eq(jobPostings.department, filters.department));
      if (filters.employmentType) conditions.push(eq(jobPostings.employmentType, filters.employmentType));
      if (filters.location) conditions.push(eq(jobPostings.location, filters.location));

      const postings = await db
        .select()
        .from(jobPostings)
        .where(and(...conditions))
        .orderBy(asc(jobPostings.deadline), asc(jobPostings.title));
      return postings.map(asJobPosting);
    },

    async listOpenFilterOptions() {
      const postings = await db
        .select({
          department: jobPostings.department,
          employmentType: jobPostings.employmentType,
          location: jobPostings.location,
        })
        .from(jobPostings)
        .where(and(...openPostingConditions()));

      return {
        departments: [...new Set(postings.map((posting) => posting.department))].sort(),
        employmentTypes: [...new Set(postings.map((posting) => posting.employmentType))].sort(),
        locations: [...new Set(postings.map((posting) => posting.location))].sort(),
      };
    },

    async findOpen(id) {
      const [posting] = await db
        .select()
        .from(jobPostings)
        .where(and(eq(jobPostings.id, id), ...openPostingConditions()));
      return posting && asJobPosting(posting);
    },

    /** Looks up a Job Posting regardless of its draft/open/closed/filled status, e.g. to check its deadline for the Frozen rule (ADR-0005). */
    async findById(id) {
      const [posting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id)).limit(1);
      return posting && asJobPosting(posting);
    },
  };
}

function openPostingConditions() {
  return [eq(jobPostings.status, "open"), gt(jobPostings.deadline, new Date())];
}
