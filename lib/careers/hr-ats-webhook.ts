import crypto from "node:crypto";

import { z } from "zod";

import { createApplicationStore } from "./applications";
import { getCareersDatabase } from "./db";
import { createJobPostingStore, type JobPostingEvent } from "./job-postings";

const jobPostingData = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  department: z.string().min(1),
  description: z.string(),
  requirements: z.string(),
  employmentType: z.string().min(1),
  location: z.string().min(1),
  deadline: z.string().datetime({ offset: true }),
  requiredDocuments: z.array(z.string()),
  screeningCriteria: z.array(z.string()),
  status: z.enum(["open", "closed", "filled"]),
});

const jobPostingEvent = z.object({
  event: z.enum(["job_posting.created", "job_posting.updated", "job_posting.closed"]),
  data: jobPostingData,
});

const applicationStatusEvent = z.object({
  event: z.literal("application.status_changed"),
  data: z.object({
    referenceNumber: z.string().min(1),
    status: z.string().min(1),
  }),
});

export type ApplicationStatusEvent = z.infer<typeof applicationStatusEvent>;

const hrAtsWebhookEvent = z.union([jobPostingEvent, applicationStatusEvent]);

export type HrAtsWebhookEvent = z.infer<typeof hrAtsWebhookEvent>;

function signatureFor(rawBody: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Verifies the raw HMAC-signed payload before any JSON parsing occurs. */
export function verifyHrAtsWebhook(rawBody: string, headers: Headers): unknown {
  const secret = process.env.HR_ATS_WEBHOOK_SECRET;
  const supplied = headers.get("X-HR-ATS-Signature")?.replace(/^sha256=/, "");
  if (!secret || !supplied) throw new Error("Missing HR-ATS webhook signature");

  const expected = signatureFor(rawBody, secret);
  const valid =
    supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) throw new Error("Invalid HR-ATS webhook signature");

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid HR-ATS webhook body");
  }
}

/** Parses a signed webhook payload, either a Job-Posting sync or an Application-status change, before any database mutation is attempted. */
export function parseHrAtsWebhookEvent(payload: unknown): HrAtsWebhookEvent {
  return hrAtsWebhookEvent.parse(payload);
}

/** Applies valid HR-ATS Job Posting updates to the local careers cache. */
export async function syncJobPostingWebhook(event: JobPostingEvent) {
  await createJobPostingStore(getCareersDatabase()).applyEvent(event);
}

/** Mirrors an HR-ATS Application-status change into the local read-model the Applicant's dashboard renders from. */
export async function syncApplicationStatusWebhook(event: ApplicationStatusEvent) {
  await createApplicationStore(getCareersDatabase()).updateStatus(event.data.referenceNumber, event.data.status);
}
