import {
  parseJobPostingWebhook,
  syncJobPostingWebhook,
  verifyHrAtsWebhook,
} from "../../../../lib/careers/hr-ats-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = parseJobPostingWebhook(verifyHrAtsWebhook(rawBody, request.headers));
  } catch {
    return Response.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  try {
    await syncJobPostingWebhook(event);
  } catch {
    return Response.json({ error: "Unable to sync Job Posting" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
