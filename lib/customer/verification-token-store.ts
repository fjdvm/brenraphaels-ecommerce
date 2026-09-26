import { createHash } from "node:crypto";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { usedEmailVerificationTokens } from "../db/schema";
import type { VerificationTokenStore } from "./email-verification";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createVerificationTokenStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): VerificationTokenStore {
  return {
    async claimVerifiedToken(token, verifiedAt) {
      const result = await db
        .insert(usedEmailVerificationTokens)
        .values({ tokenHash: tokenHash(token), verifiedAt })
        .onConflictDoNothing()
        .returning({ tokenHash: usedEmailVerificationTokens.tokenHash });

      return result.length === 1;
    },
  };
}
