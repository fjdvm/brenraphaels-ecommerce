import { and, eq, lte, or, sql } from "drizzle-orm";

import { getDatabase } from "../db";
import { orderEmailOutcomes } from "../db/schema";

type Database = ReturnType<typeof getDatabase>;

/** A send is tried this many times in all, the first one included, before its outcome becomes failed. */
export const MAX_EMAIL_ATTEMPTS = 4;
/** Minutes to wait after the 1st, 2nd and 3rd failed attempt. The retry job runs every five minutes. */
const RETRY_DELAY_MINUTES = [5, 15, 60];
/** A send that never recorded an outcome (the server stopped mid-send) is retried after this long. */
const STUCK_AFTER_MINUTES = 15;

export type EmailOutcome = "sent" | "failed" | "retrying";

function reasonOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

/** Stores the result of attempt number `attempts`: sent, waiting for the next try, or failed for good with the reason. */
async function recordAttempt(
  db: Database,
  orderId: number,
  kind: string,
  attempts: number,
  error?: unknown,
): Promise<EmailOutcome> {
  const where = and(eq(orderEmailOutcomes.orderId, orderId), eq(orderEmailOutcomes.kind, kind));
  if (error === undefined) {
    await db.update(orderEmailOutcomes)
      .set({ status: "sent", reason: null, nextAttemptAt: null, updatedAt: sql`now()` }).where(where);
    return "sent";
  }
  const reason = reasonOf(error);
  if (attempts >= MAX_EMAIL_ATTEMPTS) {
    await db.update(orderEmailOutcomes)
      .set({ status: "failed", reason, nextAttemptAt: null, updatedAt: sql`now()` }).where(where);
    return "failed";
  }
  const delay = RETRY_DELAY_MINUTES[Math.min(attempts, RETRY_DELAY_MINUTES.length) - 1];
  await db.update(orderEmailOutcomes)
    .set({ status: "retrying", reason, nextAttemptAt: sql`now() + make_interval(mins => ${delay})`, updatedAt: sql`now()` })
    .where(where);
  return "retrying";
}

/**
 * Sends one kind of email at most once per Order on the first try and records the outcome on the Order. The first insert
 * claims the send; a repeat finds the row and does nothing. A failed send is kept as "retrying" for the retry job
 * (`retryDueEmails`). Returns the outcome, or "skipped" when another confirmation already claimed it.
 */
export async function sendOnceAndRecord(
  orderId: number,
  kind: string,
  send: () => Promise<void>,
  db: Database = getDatabase(),
): Promise<EmailOutcome | "skipped"> {
  const claimed = await db
    .insert(orderEmailOutcomes)
    .values({ orderId, kind, status: "sending", attempts: 1 })
    .onConflictDoNothing()
    .returning({ orderId: orderEmailOutcomes.orderId });
  if (claimed.length === 0) return "skipped";

  try {
    await send();
  } catch (error) {
    return recordAttempt(db, orderId, kind, 1, error);
  }
  return recordAttempt(db, orderId, kind, 1);
}

/**
 * The retry job: tries again every email that failed and is due, or got stuck mid-send. Each row is claimed with one
 * update, so two overlapping runs never send the same email twice. Bounded per run so an outage cannot run long.
 * Returns how many were sent.
 */
export async function retryDueEmails(
  resend: (orderId: number, kind: string) => Promise<void>,
  db: Database = getDatabase(),
  limit = 10,
): Promise<number> {
  const due = or(
    and(eq(orderEmailOutcomes.status, "retrying"), lte(orderEmailOutcomes.nextAttemptAt, sql`now()`)),
    and(eq(orderEmailOutcomes.status, "sending"), lte(orderEmailOutcomes.updatedAt, sql`now() - make_interval(mins => ${STUCK_AFTER_MINUTES})`)),
  );
  const candidates = await db.select({ orderId: orderEmailOutcomes.orderId, kind: orderEmailOutcomes.kind })
    .from(orderEmailOutcomes).where(due).orderBy(orderEmailOutcomes.updatedAt).limit(limit);

  let sent = 0;
  for (const { orderId, kind } of candidates) {
    const [claimed] = await db.update(orderEmailOutcomes)
      .set({ status: "sending", attempts: sql`${orderEmailOutcomes.attempts} + 1`, updatedAt: sql`now()` })
      .where(and(eq(orderEmailOutcomes.orderId, orderId), eq(orderEmailOutcomes.kind, kind), due))
      .returning({ attempts: orderEmailOutcomes.attempts });
    if (!claimed) continue;
    try {
      await resend(orderId, kind);
    } catch (error) {
      await recordAttempt(db, orderId, kind, claimed.attempts, error);
      continue;
    }
    await recordAttempt(db, orderId, kind, claimed.attempts);
    sent += 1;
  }
  return sent;
}
