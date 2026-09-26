import { lte } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { emailVerificationResends } from "../db/schema";
import { resendCooldownSeconds, type VerificationResendStore } from "./email-verification";

export function createVerificationResendStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): VerificationResendStore {
  return {
    async claimResend(email, requestedAt) {
      const cutoff = new Date(requestedAt.getTime() - resendCooldownSeconds * 1_000);
      const result = await db
        .insert(emailVerificationResends)
        .values({ email, lastSentAt: requestedAt })
        .onConflictDoUpdate({
          target: emailVerificationResends.email,
          set: { lastSentAt: requestedAt },
          setWhere: lte(emailVerificationResends.lastSentAt, cutoff),
        })
        .returning({ email: emailVerificationResends.email });

      return result.length === 1;
    },
  };
}
