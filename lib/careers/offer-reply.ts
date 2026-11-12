/** What the Applicant answers. HRMS applies the same rules as when Staff record a reply, and a reply is final. */
export type OfferAnswer = "Accepted" | "Declined";

/** Replying to an Offer goes through this narrow gateway, which calls HRMS (ADR-0002). Careers never writes the Offer itself. */
export type OfferReplyGateway = {
  reply(input: { offerId: number; applicantId: string; answer: OfferAnswer }): Promise<void>;
};

/** HRMS refused the reply and said why in words an Applicant can read (already answered, withdrawn, not found). */
export class OfferReplyRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OfferReplyRefusal";
  }
}

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * The real gateway: `POST {HRMS_URL}/api/careers/offers/{id}/reply` with the Careers caller key as a bearer token.
 * The Applicant id is the one Careers signed in; HRMS checks the Offer belongs to that Applicant. Server-side only.
 */
export function createHrmsOfferReplyGateway(options: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}): OfferReplyGateway {
  const env = options.env ?? process.env;
  const send = options.fetch ?? fetch;
  return {
    async reply({ offerId, applicantId, answer }) {
      const base = env.HRMS_URL?.trim();
      const key = env.CAREERS_CALLER_KEY?.trim();
      if (!base || !key) throw new Error("HRMS is not configured for offer replies");
      const response = await send(`${base.replace(/\/$/, "")}/api/careers/offers/${encodeURIComponent(String(offerId))}/reply`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ applicantId, answer }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return;
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      // A 4xx other than an auth failure is a refusal with a clear message; anything else is a failure to retry.
      if ([400, 404, 409].includes(response.status) && typeof body?.message === "string") throw new OfferReplyRefusal(body.message, response.status);
      throw new Error(`HRMS answered ${response.status}`);
    },
  };
}

/** The one flag that switches Accept offer and Decline on. Off unless explicitly "true". It also gates the Interview reschedule request. */
export function offerRepliesEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CAREERS_OFFER_REPLIES_ENABLED === "true";
}

export const offerRepliesComingSoon = "Coming soon. We'll email you the details.";

export type OfferReplyOutcome = { ok: true } | { ok: false; message: string };

export type OfferReply = { kind: "accept" | "decline" };

/** Sends a reply through the gateway when the flag is on; with it off nothing is sent. A refusal shows HRMS's own words, a failure a retry. */
export async function replyToOffer(
  reply: OfferReply & { applicantId: string; offerId: number },
  deps: { enabled: boolean; gateway: OfferReplyGateway },
): Promise<OfferReplyOutcome> {
  if (!deps.enabled) return { ok: false, message: offerRepliesComingSoon };
  try {
    await deps.gateway.reply({ offerId: reply.offerId, applicantId: reply.applicantId, answer: reply.kind === "accept" ? "Accepted" : "Declined" });
    return { ok: true };
  } catch (error) {
    if (error instanceof OfferReplyRefusal) return { ok: false, message: error.message };
    console.error("Offer reply could not be sent", error instanceof Error ? error.message : error);
    return {
      ok: false,
      message: reply.kind === "accept" ? "We couldn't accept your offer. Try again." : "We couldn't decline your offer. Try again.",
    };
  }
}
