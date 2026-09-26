import { sendMagicLinkEmail } from "../../../../lib/email/neon-auth-email";
import { verifyNeonWebhook } from "../../../../lib/neon-auth/webhook";

export const maxDuration = 10;
export const runtime = "nodejs";

export async function POST(request: Request) {
  // The signature covers the original bytes, so parse only after verification.
  const rawBody = await request.text();

  let webhook;
  try {
    webhook = await verifyNeonWebhook(rawBody, request.headers);
  } catch {
    return Response.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  if (webhook.event_type !== "send.magic_link") {
    return Response.json({ error: "Unsupported webhook event" }, { status: 400 });
  }

  const linkType = webhook.event_data?.link_type;
  const token = webhook.event_data?.token;
  const recipient = webhook.user?.email;
  if (
    (linkType !== "email-verification" && linkType !== "forget-password") ||
    !token ||
    !recipient
  ) {
    return Response.json({ error: "Invalid magic-link event" }, { status: 400 });
  }

  try {
    await sendMagicLinkEmail({ linkType, recipient, token });
  } catch {
    return Response.json({ error: "Unable to send email" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
