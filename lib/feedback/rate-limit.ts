import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { feedbackRateLimits } from "../db/schema";

export const feedbackRateLimitWindowMs = 30 * 60 * 1_000;
export const feedbackRateLimitMax = 5;

export type FeedbackRateLimiter = {
  recordAttempt(ipAddress: string, now: Date): Promise<"allowed" | "rate-limited">;
};

/** One row per IP; a submission after the window has elapsed starts a fresh window. */
export function createFeedbackRateLimiter<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): FeedbackRateLimiter {
  return {
    async recordAttempt(ipAddress, now) {
      const cutoff = new Date(now.getTime() - feedbackRateLimitWindowMs);
      const [result] = await db
        .insert(feedbackRateLimits)
        .values({ ipAddress, windowStart: now, submissionCount: 1 })
        .onConflictDoUpdate({
          target: feedbackRateLimits.ipAddress,
          set: {
            windowStart: sql`case when ${feedbackRateLimits.windowStart} < ${cutoff} then ${now} else ${feedbackRateLimits.windowStart} end`,
            submissionCount: sql`case when ${feedbackRateLimits.windowStart} < ${cutoff} then 1 else ${feedbackRateLimits.submissionCount} + 1 end`,
          },
        })
        .returning({ submissionCount: feedbackRateLimits.submissionCount });

      return result.submissionCount > feedbackRateLimitMax ? "rate-limited" : "allowed";
    },
  };
}
