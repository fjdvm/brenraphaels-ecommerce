/** Replying to an Offer goes through this narrow gateway so HR-ATS's real endpoints can replace the stub without touching the screens. */
export type OfferReplyGateway = {
  accept(input: { applicantId: string; referenceNumber: string }): Promise<void>;
  decline(input: { applicantId: string; referenceNumber: string; reason: string }): Promise<void>;
};

/** Stand-in until HR-ATS provides the endpoints; it never pretends to have sent a reply. */
export const stubOfferReplyGateway: OfferReplyGateway = {
  async accept() {
    throw new Error("HR-ATS offer replies are not available yet");
  },
  async decline() {
    throw new Error("HR-ATS offer replies are not available yet");
  },
};

/** The one flag that switches Accept offer and Decline on. Off unless explicitly "true". */
export function offerRepliesEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CAREERS_OFFER_REPLIES_ENABLED === "true";
}

export const offerRepliesComingSoon = "Coming soon. We'll email you the details.";

export type OfferReplyOutcome = { ok: true } | { ok: false; message: string };

export type OfferReply = { kind: "accept" } | { kind: "decline"; reason: string };

/** Sends a reply through the gateway when the flag is on; with it off nothing is sent. */
export async function replyToOffer(
  reply: OfferReply & { applicantId: string; referenceNumber: string },
  deps: { enabled: boolean; gateway: OfferReplyGateway },
): Promise<OfferReplyOutcome> {
  if (!deps.enabled) return { ok: false, message: offerRepliesComingSoon };
  const { applicantId, referenceNumber } = reply;
  try {
    if (reply.kind === "accept") await deps.gateway.accept({ applicantId, referenceNumber });
    else await deps.gateway.decline({ applicantId, referenceNumber, reason: reply.reason });
    return { ok: true };
  } catch (error) {
    console.error("Offer reply could not be sent", error);
    return {
      ok: false,
      message: reply.kind === "accept" ? "We couldn't accept your offer. Try again." : "We couldn't decline your offer. Try again.",
    };
  }
}
