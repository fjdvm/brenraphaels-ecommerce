import { sendMagicLinkEmail } from "@/lib/email/neon-auth-email";
import { verifyNeonWebhook } from "@/lib/neon-auth/webhook";

export const maxDuration = 10;
export const runtime = "nodejs";

/**
 * Careers has its own Neon Auth webhook. It deliberately verifies against the
 * Careers issuer and emits links into `/careers`, never Customer auth routes.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const baseUrl = process.env.CAREERS_NEON_AUTH_BASE_URL;

  if (!baseUrl) {
    return Response.json({ error: "Careers Auth is not configured" }, { status: 500 });
  }

  let webhook;
  try {
    webhook = await verifyNeonWebhook(rawBody, request.headers, baseUrl);
  } catch {
    return Response.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  const linkType = webhook.event_data?.link_type;
  const token = webhook.event_data?.token;
  const recipient = webhook.user?.email;
  if (
    webhook.event_type !== "send.magic_link" ||
    (linkType !== "email-verification" && linkType !== "forget-password") ||
    !token ||
    !recipient
  ) {
    return Response.json({ error: "Invalid magic-link event" }, { status: 400 });
  }

  try {
    await sendMagicLinkEmail({ linkType, recipient, token, pathPrefix: "/careers" });
  } catch {
    return Response.json({ error: "Unable to send email" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
