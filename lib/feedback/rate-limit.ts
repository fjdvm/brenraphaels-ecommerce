import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { feedbackRateLimits } from "../db/schema";

export const feedbackRateLimitWindowMs = 30 * 60 * 1_000;
export const feedbackRateLimitMax = 5;

export type FeedbackRateLimiter = {
  recordAttempt(ipAddress: string, now: Date): Promise<"allowed" | "rate-limited">;
};

/**
 * Keeps each IP's recent submission times so the window genuinely rolls: an old
 * submission ages out on its own instead of the whole window resetting together.
 */
export function createFeedbackRateLimiter<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): FeedbackRateLimiter {
  return {
    async recordAttempt(ipAddress, now) {
      const cutoff = new Date(now.getTime() - feedbackRateLimitWindowMs);

      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ submissionTimes: feedbackRateLimits.submissionTimes })
          .from(feedbackRateLimits)
          .where(eq(feedbackRateLimits.ipAddress, ipAddress))
          .for("update");

        const recentSubmissions = (existing?.submissionTimes ?? []).filter((time) => time > cutoff);
        if (recentSubmissions.length >= feedbackRateLimitMax) {
          return "rate-limited" as const;
        }

        await tx
          .insert(feedbackRateLimits)
          .values({ ipAddress, submissionTimes: [...recentSubmissions, now] })
          .onConflictDoUpdate({
            target: feedbackRateLimits.ipAddress,
            set: { submissionTimes: [...recentSubmissions, now] },
          });

        return "allowed" as const;
      });
    },
  };
}
