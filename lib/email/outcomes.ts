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

/** What a sender hands back when the provider accepted the message. */
export interface SendReceipt { messageId?: string }
/** Sends one email. `id` is the email's stable id: the same for the first send, every retry and every Resend. */
export type EmailSend = (email: { id: string }) => Promise<SendReceipt | void>;

/** One stable id per event occurrence, so a retry or Resend of the same event can never be a second email. */
export function stableEmailId(orderId: number, kind: string, occurrence = ""): string {
  return `order-${orderId}-${kind}${occurrence ? `-${occurrence}` : ""}`;
}

function reasonOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

const rowIs = (orderId: number, kind: string, occurrence: string) =>
  and(eq(orderEmailOutcomes.orderId, orderId), eq(orderEmailOutcomes.kind, kind), eq(orderEmailOutcomes.occurrence, occurrence));

/** Stores the result of attempt number `attempts`: sent, waiting for the next try, or failed for good with the reason. */
async function recordAttempt(
  db: Database,
  orderId: number,
  kind: string,
  occurrence: string,
  attempts: number,
  error?: unknown,
  receipt?: SendReceipt | void,
): Promise<EmailOutcome> {
  const where = rowIs(orderId, kind, occurrence);
  if (error === undefined) {
    await db.update(orderEmailOutcomes)
      .set({ status: "sent", reason: null, nextAttemptAt: null, ...(receipt?.messageId ? { messageId: receipt.messageId } : {}), updatedAt: sql`now()` }).where(where);
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
 * Sends one occurrence of one kind of email at most once per Order on the first try and records the outcome on the
 * Order. The first insert claims the send; a repeat finds the row and does nothing. Two real rejections pass two
 * occurrences, so each gets its own row, id and email. A failed send is kept as "retrying" for the retry job
 * (`retryDueEmails`). Returns the outcome, or "skipped" when this occurrence was already claimed.
 */
export async function sendOnceAndRecord(
  orderId: number,
  kind: string,
  send: EmailSend,
  db: Database = getDatabase(),
  occurrence = "",
): Promise<EmailOutcome | "skipped"> {
  const claimed = await db
    .insert(orderEmailOutcomes)
    .values({ orderId, kind, occurrence, status: "sending", attempts: 1 })
    .onConflictDoNothing()
    .returning({ orderId: orderEmailOutcomes.orderId });
  if (claimed.length === 0) return "skipped";

  let receipt: SendReceipt | void;
  try {
    receipt = await send({ id: stableEmailId(orderId, kind, occurrence) });
  } catch (error) {
    return recordAttempt(db, orderId, kind, occurrence, 1, error);
  }
  return recordAttempt(db, orderId, kind, occurrence, 1, undefined, receipt);
}

/**
 * The retry job: tries again every email that failed and is due, or got stuck mid-send. Each row is claimed with one
 * update, so two overlapping runs never send the same email twice. Bounded per run so an outage cannot run long.
 * Returns how many were sent.
 */
export async function retryDueEmails(
  resend: (orderId: number, kind: string, occurrence: string, email: { id: string }) => Promise<SendReceipt | void>,
  db: Database = getDatabase(),
  limit = 10,
): Promise<number> {
  const due = or(
    and(eq(orderEmailOutcomes.status, "retrying"), lte(orderEmailOutcomes.nextAttemptAt, sql`now()`)),
    and(eq(orderEmailOutcomes.status, "sending"), lte(orderEmailOutcomes.updatedAt, sql`now() - make_interval(mins => ${STUCK_AFTER_MINUTES})`)),
  );
  const candidates = await db.select({ orderId: orderEmailOutcomes.orderId, kind: orderEmailOutcomes.kind, occurrence: orderEmailOutcomes.occurrence })
    .from(orderEmailOutcomes).where(due).orderBy(orderEmailOutcomes.updatedAt).limit(limit);

  let sent = 0;
  for (const { orderId, kind, occurrence } of candidates) {
    const [claimed] = await db.update(orderEmailOutcomes)
      .set({ status: "sending", attempts: sql`${orderEmailOutcomes.attempts} + 1`, updatedAt: sql`now()` })
      .where(and(rowIs(orderId, kind, occurrence), due))
      .returning({ attempts: orderEmailOutcomes.attempts, messageId: orderEmailOutcomes.messageId });
    if (!claimed) continue;
    // Notification already accepted it (the process stopped before the outcome was saved): record it, never send again.
    if (claimed.messageId) {
      await recordAttempt(db, orderId, kind, occurrence, claimed.attempts);
      sent += 1;
      continue;
    }
    let receipt: SendReceipt | void;
    try {
      receipt = await resend(orderId, kind, occurrence, { id: stableEmailId(orderId, kind, occurrence) });
    } catch (error) {
      await recordAttempt(db, orderId, kind, occurrence, claimed.attempts, error);
      continue;
    }
    await recordAttempt(db, orderId, kind, occurrence, claimed.attempts, undefined, receipt);
    sent += 1;
  }
  return sent;
}

export type ResendResult =
  | { ok: true; status: "sent" | "reconciled" }
  | { ok: false; reason: string; refused: "not-failed" | "send-failed" };

/**
 * A Staff or Manager Resend once retries ran out. The failed row is claimed with one update (failed to sending), so two
 * Resends of the same event send once and the second is refused. If Notification already accepted the email (a stored
 * message id) the delivery status is reconciled first: the row becomes sent and nothing is sent. Otherwise it is sent
 * under the same stable id and a failure puts the row back to failed with the new reason. The saved Order update is
 * never touched.
 */
export async function resendFailedEmail(
  orderId: number,
  kind: string,
  occurrence: string,
  send: EmailSend,
  db: Database = getDatabase(),
): Promise<ResendResult> {
  const [claimed] = await db.update(orderEmailOutcomes)
    .set({ status: "sending", updatedAt: sql`now()` })
    .where(and(rowIs(orderId, kind, occurrence), eq(orderEmailOutcomes.status, "failed")))
    .returning({ attempts: orderEmailOutcomes.attempts, messageId: orderEmailOutcomes.messageId });
  if (!claimed) return { ok: false, reason: "That email is not marked as failed.", refused: "not-failed" };

  if (claimed.messageId) {
    await db.update(orderEmailOutcomes)
      .set({ status: "sent", reason: null, nextAttemptAt: null, updatedAt: sql`now()` }).where(rowIs(orderId, kind, occurrence));
    return { ok: true, status: "reconciled" };
  }
  let receipt: SendReceipt | void;
  try {
    receipt = await send({ id: stableEmailId(orderId, kind, occurrence) });
  } catch (error) {
    await db.update(orderEmailOutcomes)
      .set({ status: "failed", reason: reasonOf(error), updatedAt: sql`now()` }).where(rowIs(orderId, kind, occurrence));
    return { ok: false, reason: "The email could not be sent again. Try again later.", refused: "send-failed" };
  }
  await db.update(orderEmailOutcomes)
    .set({ status: "sent", reason: null, nextAttemptAt: null, attempts: sql`${orderEmailOutcomes.attempts} + 1`,
      ...(receipt?.messageId ? { messageId: receipt.messageId } : {}), updatedAt: sql`now()` })
    .where(rowIs(orderId, kind, occurrence));
  return { ok: true, status: "sent" };
}
