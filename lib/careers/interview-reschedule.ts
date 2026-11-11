import { offerRepliesComingSoon } from "./offer-reply";

/** Asking to move an Interview goes through this narrow gateway so HR-ATS's real endpoint can replace the stub without touching the screens. HR-ATS enforces one request per Interview and none within 24 hours of it. */
export type InterviewRescheduleGateway = {
  request(input: { applicantId: string; referenceNumber: string; preferredAt: Date; note: string }): Promise<void>;
};

/** Stand-in until HR-ATS provides the endpoint; it never pretends to have sent a request. */
export const stubInterviewRescheduleGateway: InterviewRescheduleGateway = {
  async request() {
    throw new Error("HR-ATS interview rescheduling is not available yet");
  },
};

/** Same flag and note as the Offer replies: one switch for everything that waits on HR-ATS. */
export const rescheduleComingSoon = offerRepliesComingSoon;

export type RescheduleOutcome = { ok: true } | { ok: false; message: string };

const MANILA_OFFSET = "+08:00";

/** The Asia/Manila date ("YYYY-MM-DD") and time ("HH:mm") as one instant, or null when they are not a real moment. */
export function preferredInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const instant = new Date(`${date}T${time}:00${MANILA_OFFSET}`);
  if (Number.isNaN(instant.getTime())) return null;
  // Rejects rolled-over dates such as 2026-02-31.
  return new Date(`${date}T00:00:00Z`).toISOString().startsWith(date) ? instant : null;
}

export const pastDateMessage = "Choose a day and time that haven't passed yet.";

/** Asks for a new Interview time through the gateway when the flag is on; with it off nothing is sent. */
export async function requestReschedule(
  request: { applicantId: string; referenceNumber: string; date: string; time: string; note: string },
  deps: { enabled: boolean; gateway: InterviewRescheduleGateway; now?: Date },
): Promise<RescheduleOutcome> {
  if (!deps.enabled) return { ok: false, message: rescheduleComingSoon };
  const preferredAt = preferredInstant(request.date, request.time);
  if (!preferredAt) return { ok: false, message: "Choose a day and a time." };
  if (preferredAt.getTime() <= (deps.now ?? new Date()).getTime()) return { ok: false, message: pastDateMessage };
  try {
    await deps.gateway.request({ applicantId: request.applicantId, referenceNumber: request.referenceNumber, preferredAt, note: request.note });
    return { ok: true };
  } catch (error) {
    console.error("Interview reschedule could not be requested", error);
    return { ok: false, message: "We couldn't send your request. Try again." };
  }
}
