import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { customers, seniorPwdVerifications } from "../db/schema";
import { hashIdNumber, philippineToday, PHOTO_REVIEW_DAYS, type IdType } from "./id-number";

export type VerificationStatus = "pending" | "approved" | "declined" | "revoked" | "expired";
export type VerificationAction = "approve" | "decline" | "revoke";

export class SeniorPwdNotFound extends Error {}
/** The verification is not in a state this decision applies to, or the ID is on another account. */
export class SeniorPwdConflict extends Error {}
export class SeniorPwdInvalid extends Error {}

export type Verification = {
  id: number;
  customerId: string;
  idType: IdType;
  status: VerificationStatus;
  submittedAt: Date;
  expiresOn: string | null;
};

type Row = typeof seniorPwdVerifications.$inferSelect;
// Both a database and a transaction fit.
type Db = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/** What the Customer is as of now: a pending one past 7 days lost its photo; an approved one stops on its expiry date. */
export function currentStatus(row: Pick<Row, "status" | "submittedAt" | "expiresOn">, now: Date): VerificationStatus {
  const status = row.status as VerificationStatus;
  if (status === "pending" && row.submittedAt.getTime() + PHOTO_REVIEW_DAYS * 86_400_000 <= now.getTime()) return "expired";
  if (status === "approved" && row.expiresOn !== null && row.expiresOn <= philippineToday(now)) return "expired";
  return status;
}

function toVerification(row: Row, now: Date): Verification {
  return { id: row.id, customerId: row.customerId, idType: row.idType as IdType, status: currentStatus(row, now),
    submittedAt: row.submittedAt, expiresOn: row.expiresOn };
}

/** The Customer's latest verification, if any, with its status as of now. */
export async function latestVerification(db: Db, customerId: string, now = new Date()): Promise<Verification | null> {
  const [row] = await db.select().from(seniorPwdVerifications)
    .where(eq(seniorPwdVerifications.customerId, customerId)).orderBy(desc(seniorPwdVerifications.id)).limit(1);
  return row ? toVerification(row, now) : null;
}

/** The Customer's verification that already gives the discount (approved and not past its expiry), if any. */
export async function activeVerification(db: Db, customerId: string, now = new Date()): Promise<Verification | null> {
  const latest = await latestVerification(db, customerId, now);
  return latest?.status === "approved" ? latest : null;
}

/** Whether the number may be sent for review: pending or approved on another account means it is in use. */
async function takenElsewhere(db: Db, idHash: string, customerId: string | undefined) {
  const [taken] = await db.select({ id: seniorPwdVerifications.id }).from(seniorPwdVerifications)
    .where(and(eq(seniorPwdVerifications.idHash, idHash), inArray(seniorPwdVerifications.status, ["pending", "approved"]),
      customerId === undefined ? undefined : ne(seniorPwdVerifications.customerId, customerId))).limit(1);
  return Boolean(taken);
}

/**
 * Whether this ID number is already used by another account (pending or approved), checked before anything is uploaded or
 * any account is made. `customerId` is the signed-in Customer, whose own ID never counts against them; undefined at sign-up.
 * `submitVerification` checks again under a lock, so this is a courtesy, not the guard.
 */
export async function idNumberInUse(db: Db, idNumber: string, customerId?: string): Promise<boolean> {
  return takenElsewhere(db, hashIdNumber(idNumber), customerId);
}

/** How the number the browser read off the photo compares with the one sent. Only this outcome is kept, never either number. */
export type IdNumberRead = "matched" | "differs" | "unread";

export function compareIdNumberRead(idHash: string, idNumberRead: string | undefined): IdNumberRead {
  if (!idNumberRead?.trim()) return "unread";
  return hashIdNumber(idNumberRead) === idHash ? "matched" : "differs";
}

/**
 * Records the Customer's ID for review. The number is hashed here and never kept. A number pending or approved on another
 * account is refused; one last seen declined, revoked or expired is accepted but flagged (`sameIdAsVerificationId`).
 */
export async function submitVerification(
  db: Db,
  customerId: string,
  input: { idType: IdType; idNumber: string; idNumberRead?: string; photoFileId: string; photoBackFileId?: string },
  now = new Date(),
): Promise<number> {
  const idHash = hashIdNumber(input.idNumber);
  // One submission of this number at a time, so two accounts sending it together cannot both pass the check below.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${idHash}))`);
    if (await takenElsewhere(tx, idHash, customerId)) throw new SeniorPwdConflict("This ID is already used by another account.");
    // A number last seen on another account (declined, revoked, expired) is accepted but flagged, so Staff can tell.
    const [before] = await tx.select({ id: seniorPwdVerifications.id }).from(seniorPwdVerifications)
      .where(and(eq(seniorPwdVerifications.idHash, idHash), ne(seniorPwdVerifications.customerId, customerId)))
      .orderBy(desc(seniorPwdVerifications.id)).limit(1);
    const [row] = await tx.insert(seniorPwdVerifications).values({
      customerId, idType: input.idType, idHash, photoFileId: input.photoFileId,
      photoBackFileId: input.photoBackFileId ?? null, submittedAt: now, sameIdAsVerificationId: before?.id ?? null,
      idNumberRead: compareIdNumberRead(idHash, input.idNumberRead),
    }).returning({ id: seniorPwdVerifications.id });
    return row.id;
  });
}

export type Decision = {
  action: VerificationAction;
  expiresOn?: string;
  override?: boolean;
  reason?: string;
  staffId: string;
  staffName: string;
};

/**
 * A Staff decision from CREOMS. Approve needs the ID's expiry date; decline and revoke need a reason.
 * Returns the Customer's email and the File ids to delete, so the caller can email once and remove the photos.
 */
export async function decideVerification(db: Db & { transaction: Db["transaction"] }, id: number, decision: Decision, now = new Date()) {
  if (!decision.staffId.trim() || !decision.staffName.trim()) throw new SeniorPwdInvalid("Staff attribution is required.");
  const reason = decision.reason?.trim() ?? "";
  if (decision.action !== "approve" && !reason) throw new SeniorPwdInvalid("A reason is required.");
  if (decision.action === "approve") {
    const expiry = decision.expiresOn ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || new Date(`${expiry}T00:00:00Z`).toISOString().slice(0, 10) !== expiry) {
      throw new SeniorPwdInvalid("Enter the ID's expiry date.");
    }
    if (expiry <= philippineToday(now)) throw new SeniorPwdInvalid("This ID has expired.");
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(seniorPwdVerifications).where(eq(seniorPwdVerifications.id, id)).for("update");
    if (!row) throw new SeniorPwdNotFound("Verification was not found.");
    const stored = row.status;
    const allowed = decision.action === "approve"
      ? stored === "pending" || (decision.override === true && (stored === "declined" || stored === "revoked"))
      : decision.action === "decline" ? stored === "pending" : stored === "approved";
    // A pending verification whose photo has gone is no longer for review.
    if (!allowed || (stored === "pending" && currentStatus(row, now) !== "pending")) throw new SeniorPwdConflict("Verification already changed.");
    if (decision.action === "approve") {
      const [other] = await tx.select({ id: seniorPwdVerifications.id }).from(seniorPwdVerifications)
        .where(and(eq(seniorPwdVerifications.idHash, row.idHash), ne(seniorPwdVerifications.id, id),
          eq(seniorPwdVerifications.status, "approved"), sql`${seniorPwdVerifications.expiresOn} > ${philippineToday(now)}`)).limit(1);
      if (other) throw new SeniorPwdConflict("This ID is already verified on another account.");
    }
    const status = { approve: "approved", decline: "declined", revoke: "revoked" }[decision.action];
    const expiresOn = decision.action === "approve" ? decision.expiresOn! : row.expiresOn;
    const [customer] = await tx.select({ email: customers.email, firstName: customers.firstName, fullName: customers.fullName })
      .from(customers).where(eq(customers.id, row.customerId));
    await tx.update(seniorPwdVerifications).set({
      status, photoFileId: null, photoBackFileId: null, decidedAt: now, decidedById: decision.staffId, decidedByName: decision.staffName,
      declineReason: decision.action === "approve" ? null : reason, expiresOn,
      // The name the ID was verified under, kept beside the hash so the record holds even if the account is renamed.
      ...(decision.action === "approve" ? { verifiedName: customer?.fullName ?? null } : {}),
    }).where(eq(seniorPwdVerifications.id, id));
    return {
      id, status, expiresOn, reason: decision.action === "approve" ? null : reason,
      customer: { email: customer.email, firstName: customer.firstName },
      filesToDelete: [row.photoFileId, row.photoBackFileId].filter((file): file is string => file !== null),
    };
  });
}
