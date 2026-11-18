import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { resendStaffEmail } from "@/lib/email/retry";

export const runtime = "nodejs";

const KIND = /^[a-z][a-z0-9-]{0,63}$/;
const OCCURRENCE = /^[A-Za-z0-9_-]{1,40}$/;
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

/**
 * CREOMS asks for a Resend of one failed email occurrence after retries ran out. The storefront resends under the
 * email's stable id (so a repeat never sends twice), reconciling first when Notification already accepted it, and
 * answers `sent` or `reconciled`. CREOMS audits who asked; a failed email never changes the Order.
 */
export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/email/resend">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const orderId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(orderId)) return Response.json({ error: "Invalid Order id." }, { status: 400 });
  let body: { kind?: unknown; occurrence?: unknown; staffId?: unknown; staffName?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!text(body.staffId, 100) || !text(body.staffName, 100)) return Response.json({ error: "Staff attribution is required." }, { status: 400 });
  if (typeof body.kind !== "string" || !KIND.test(body.kind)) return Response.json({ error: "Unknown email." }, { status: 400 });
  if (body.occurrence !== null && body.occurrence !== undefined && (typeof body.occurrence !== "string" || !OCCURRENCE.test(body.occurrence))) {
    return Response.json({ error: "Unknown email." }, { status: 400 });
  }
  const occurrence = typeof body.occurrence === "string" ? body.occurrence : "";
  try {
    const result = await resendStaffEmail(orderId, body.kind, occurrence);
    if (!result.ok) return Response.json({ error: result.reason, status: result.refused === "send-failed" ? "failed" : undefined }, { status: result.refused === "not-failed" ? 409 : 502 });
    return Response.json({ id: orderId, kind: body.kind, occurrence: occurrence || null, status: result.status });
  } catch {
    return Response.json({ error: "The resend could not be confirmed. Refresh the Order before retrying." }, { status: 503 });
  }
}
