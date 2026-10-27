import {
  parseHrAtsWebhookEvent,
  syncApplicationStatusWebhook,
  verifyHrAtsWebhook,
} from "../../../../lib/careers/hr-ats-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = parseHrAtsWebhookEvent(verifyHrAtsWebhook(rawBody, request.headers));
  } catch {
    return Response.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  try {
    await syncApplicationStatusWebhook(event);
  } catch {
    return Response.json({ error: "Unable to sync HR-ATS update" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
