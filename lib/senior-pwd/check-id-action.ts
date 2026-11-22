"use server";

import { allowAuthAttempt, authRateLimitMessage } from "@/lib/customer/auth-rate-limit";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { idInUseMessage } from "./application";
import { idNumberField } from "./id-fields";
import { idNumberInUse } from "./store";

export type IdNumberCheck = { ok: true } | { ok: false; message: string; field?: "idNumber" };

/**
 * Asks whether an ID number is free before the Customer goes further, so an ID used by another account is refused at once
 * (sign-up step 3, complete-profile, Account settings) and no account or upload is made for it. Rate-limited per address, so
 * it cannot be used to test many numbers. Only the outcome is returned; the number is hashed and never kept or logged.
 */
export async function checkSeniorPwdIdNumber(idNumber: string): Promise<IdNumberCheck> {
  const parsed = idNumberField.safeParse(idNumber);
  if (!parsed.success) return { ok: false, field: "idNumber", message: parsed.error.issues[0]?.message ?? "Enter your ID number" };
  if (!(await allowAuthAttempt("senior-pwd-id"))) return { ok: false, message: authRateLimitMessage };
  const visitor = await currentVisitor();
  const customerId = visitor.state === "customer" ? visitor.customer.userId : visitor.state === "needs-details" ? visitor.userId : undefined;
  try {
    if (await idNumberInUse(getDatabase(), parsed.data, customerId)) return { ok: false, field: "idNumber", message: idInUseMessage };
  } catch (error) {
    // The final check runs again when the ID is sent, so a failed courtesy check never stops the Customer.
    console.error("A Senior/PWD ID number could not be checked", error instanceof Error ? error.message : "unknown");
  }
  return { ok: true };
}
