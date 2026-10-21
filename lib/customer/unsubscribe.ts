import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { customers } from "../db/schema";

const tokenMaximumLength = 512;

function sign(customerId: string, secret: string) {
  return createHmac("sha256", secret).update(customerId).digest("base64url");
}

/**
 * An Unsubscribe token is `<base64url Customer id>.<base64url HMAC-SHA256 of the id>`,
 * signed with UNSUBSCRIBE_SECRET. It is stateless, unique to the Customer and cannot be
 * forged without the secret. CREOMS builds the same token (it shares the secret) to put
 * the link in each Marketing Email.
 */
export function unsubscribeToken(customerId: string, secret: string) {
  return `${Buffer.from(customerId).toString("base64url")}.${sign(customerId, secret)}`;
}

export function unsubscribeLink(
  customerId: string,
  options: { secret: string; siteUrl: string },
) {
  const token = unsubscribeToken(customerId, options.secret);
  return `${options.siteUrl}/unsubscribe?token=${token}`;
}

function customerIdFromToken(token: string | undefined, secret: string) {
  if (!token || token.length > tokenMaximumLength) {
    return undefined;
  }

  const [encodedId, signature, ...rest] = token.split(".");
  if (!encodedId || !signature || rest.length > 0) {
    return undefined;
  }

  const customerId = Buffer.from(encodedId, "base64url").toString();
  const expected = Buffer.from(sign(customerId, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return undefined;
  }

  return customerId;
}

export type UnsubscribeResult = "unsubscribed" | "invalid";

/** Sets the Customer's Marketing opt-in to no. Safe to repeat. */
export async function unsubscribeCustomer<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  token: string | undefined,
  dependencies: { secret: string; db: PgDatabase<TQueryResult, TSchema> },
): Promise<UnsubscribeResult> {
  const customerId = customerIdFromToken(token, dependencies.secret);
  if (!customerId) {
    return "invalid";
  }

  const updated = await dependencies.db
    .update(customers)
    .set({ marketingOptIn: false })
    .where(eq(customers.id, customerId))
    .returning({ id: customers.id });

  return updated.length === 1 ? "unsubscribed" : "invalid";
}
