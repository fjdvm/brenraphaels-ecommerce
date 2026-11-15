import { after } from "next/server";

import { sendSeniorPwdDecisionEmail } from "@/lib/email/senior-pwd-email";
import { getDatabase } from "@/lib/db";
import { creomsSeniorPwdCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { SeniorPwdConflict, SeniorPwdInvalid, SeniorPwdNotFound, decideVerification } from "@/lib/senior-pwd/store";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

export const runtime = "nodejs";

const actions = ["approve", "decline", "revoke"] as const;

/** CREOMS records a Staff decision. The Customer is emailed once, without the ID number; the photos are deleted. */
export async function POST(request: Request, context: RouteContext<"/api/internal/senior-pwd/[id]/[action]">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsSeniorPwdCredential)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, action } = await context.params;
  const verificationId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(verificationId)) return Response.json({ error: "Invalid verification id." }, { status: 400 });
  if (!(actions as readonly string[]).includes(action)) return Response.json({ error: "Unknown decision." }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value : undefined);
    const decided = await decideVerification(getDatabase(), verificationId, {
      action: action as (typeof actions)[number], expiresOn: text(body.expiresOn), override: body.override === true,
      reason: text(body.reason), staffId: text(body.staffId) ?? "", staffName: text(body.staffName) ?? "",
    });
    scheduleOrdersChanged();
    after(async () => {
      try {
        await sendSeniorPwdDecisionEmail(decided.customer.email, { status: decided.status as "approved" | "declined" | "revoked", expiresOn: decided.expiresOn, reason: decided.reason });
      } catch (error) { console.error("The Senior/PWD decision email could not be sent", error); }
      // CREOMS deletes the front photo too; file-storage's seven-day expiry covers a failed delete.
      for (const fileId of decided.filesToDelete) {
        try { await gatewayTicketFiles().remove(fileId); } catch { /* expiry removes it */ }
      }
    });
    return Response.json({ id: decided.id, status: decided.status, expiresOn: decided.expiresOn });
  } catch (error) {
    if (error instanceof SeniorPwdInvalid) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SeniorPwdNotFound) return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof SeniorPwdConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    // A failed commit acknowledgement can be uncertain. Never claim refusal or retry it automatically.
    return Response.json({ error: "Verification decision could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
