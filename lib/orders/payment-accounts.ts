import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";

import { required } from "../gateway";
import type { PaymentAccountOption } from "./payment-offer";

type Reader = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };
type Row = { id: string; method: string; label: string; account_name: string; account_number: string; bank_name: string | null; qr_file_id: string | null };

/** A short-lived signed address for a private QR File through the gateway; null when it cannot be made. */
export async function signedQrUrl(fileId: string, send: typeof fetch = fetch): Promise<string | null> {
  try {
    const base = required("API_GATEWAY_URL").replace(/\/$/, "");
    const response = await send(`${base}/files/${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const file = await response.json();
    const url = new URL(file.url);
    return file.id === fileId && url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The active Payment accounts of every enabled method a Manager or the CEO set up in CREOMS (`crms.payment_accounts`,
 * `crms.payment_methods`), read fresh each time, with a short-lived QR link where there is a QR. Empty when they cannot
 * be read: the Customer then sees the "no online method" notice, never a silent switch to Cash on Delivery.
 */
export async function loadPaymentAccounts(reader?: Reader, signQr: (fileId: string) => Promise<string | null> = signedQrUrl): Promise<PaymentAccountOption[]> {
  let rows: Row[];
  try {
    const result = await (reader ?? getDatabase()).execute(sql`
      select a.id::text as id, a.method, a.label, a.account_name, a.account_number, a.bank_name, a.qr_file_id
      from crms.payment_accounts a left join crms.payment_methods m on m.method = a.method
      where a.active and coalesce(m.enabled, true) order by a.created_at, a.id`);
    rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows ?? []) as Row[];
  } catch {
    return [];
  }
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    method: row.method === "bank_transfer" ? "bank-transfer" : (row.method as "gcash" | "maya"),
    label: row.label, accountName: row.account_name, accountNumber: row.account_number, bankName: row.bank_name,
    qrUrl: row.qr_file_id ? await signQr(row.qr_file_id).catch(() => null) : null,
  })));
}

/** The account details a proof is saved with: everything the Customer was shown, copied so a later edit never changes it. */
export type PaymentAccountSnapshot = Pick<PaymentAccountOption, "id" | "method" | "bankName" | "label" | "accountName" | "accountNumber">;

/**
 * One Payment account by id, active or not: a transfer made before the account was deactivated is still accepted and goes
 * to Staff review. Undefined when there is no such account (or it cannot be read), so the proof is refused.
 */
export async function loadPaymentAccountSnapshot(id: string, reader?: Reader): Promise<PaymentAccountSnapshot | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
  try {
    const result = await (reader ?? getDatabase()).execute(sql`
      select a.id::text as id, a.method, a.label, a.account_name, a.account_number, a.bank_name
      from crms.payment_accounts a where a.id = ${id}::uuid`);
    const [row] = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows ?? []) as Row[];
    if (!row) return undefined;
    return {
      id: row.id, method: row.method === "bank_transfer" ? "bank-transfer" : (row.method as "gcash" | "maya"),
      label: row.label, accountName: row.account_name, accountNumber: row.account_number, bankName: row.bank_name,
    };
  } catch {
    return undefined;
  }
}
