import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { applicantEducation, applicantProfiles, applicantWorkHistory } from "./schema";

const optionalText = z.string().trim().max(2_000).optional().transform((value) => value || null);
const education = z.object({ school: z.string().trim().min(1).max(200), qualification: z.string().trim().min(1).max(200), fieldOfStudy: optionalText, startedOn: z.string().max(20).optional().transform((value) => value || null), completedOn: z.string().max(20).optional().transform((value) => value || null) });
const workHistory = z.object({ employer: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(200), startedOn: z.string().max(20).optional().transform((value) => value || null), endedOn: z.string().max(20).optional().transform((value) => value || null), description: optionalText });

export const applicantProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(200), phone: optionalText, location: optionalText, summary: optionalText,
  skills: z.string().trim().max(2_000).default(""), education: z.array(education).max(20).default([]), workHistory: z.array(workHistory).max(30).default([]),
});
export type ApplicantProfileInput = z.input<typeof applicantProfileSchema>;
export type ApplicantProfile = z.output<typeof applicantProfileSchema>;
export type ApplicantProfileStore = { save(input: ApplicantProfile & { applicantId: string; email: string }): Promise<void>; find(applicantId: string): Promise<ApplicantProfile | null> };

export function createApplicantProfileStore<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(db: PgDatabase<TQueryResult, TSchema>): ApplicantProfileStore {
  return {
    async save(input) { await db.transaction(async (tx) => {
      await tx.insert(applicantProfiles).values({ applicantId: input.applicantId, email: input.email, fullName: input.fullName, phone: input.phone, location: input.location, summary: input.summary, skills: input.skills, updatedAt: new Date() }).onConflictDoUpdate({ target: applicantProfiles.applicantId, set: { fullName: input.fullName, phone: input.phone, location: input.location, summary: input.summary, skills: input.skills, updatedAt: new Date() } });
      await tx.delete(applicantEducation).where(eq(applicantEducation.applicantId, input.applicantId));
      await tx.delete(applicantWorkHistory).where(eq(applicantWorkHistory.applicantId, input.applicantId));
      if (input.education.length) await tx.insert(applicantEducation).values(input.education.map((item) => ({ ...item, applicantId: input.applicantId })));
      if (input.workHistory.length) await tx.insert(applicantWorkHistory).values(input.workHistory.map((item) => ({ ...item, applicantId: input.applicantId })));
    }); },
    async find(applicantId) {
      const [profile] = await db.select().from(applicantProfiles).where(eq(applicantProfiles.applicantId, applicantId)).limit(1);
      if (!profile) return null;
      const [educationRows, workHistoryRows] = await Promise.all([
        db.select().from(applicantEducation).where(eq(applicantEducation.applicantId, applicantId)).orderBy(asc(applicantEducation.id)),
        db.select().from(applicantWorkHistory).where(eq(applicantWorkHistory.applicantId, applicantId)).orderBy(asc(applicantWorkHistory.id)),
      ]);
      return { fullName: profile.fullName, phone: profile.phone, location: profile.location, summary: profile.summary, skills: profile.skills, education: educationRows.map(({ school, qualification, fieldOfStudy, startedOn, completedOn }) => ({ school, qualification, fieldOfStudy, startedOn, completedOn })), workHistory: workHistoryRows.map(({ employer, title, startedOn, endedOn, description }) => ({ employer, title, startedOn, endedOn, description })) };
    },
  };
}

export async function saveApplicantProfile(input: ApplicantProfileInput, dependencies: { identity: { userId: string; email: string }; store: ApplicantProfileStore }) {
  const profile = applicantProfileSchema.parse(input);
  await dependencies.store.save({ ...profile, applicantId: dependencies.identity.userId, email: dependencies.identity.email.toLowerCase() });
  return profile;
}
export async function hasApplicantProfile<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(applicantId: string, db: PgDatabase<TQueryResult, TSchema>) { const [profile] = await db.select({ id: applicantProfiles.applicantId }).from(applicantProfiles).where(eq(applicantProfiles.applicantId, applicantId)).limit(1); return Boolean(profile); }
