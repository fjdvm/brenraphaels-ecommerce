import { z } from "zod";

import { multilineTextField } from "../validators/fields";

const ticketTextPattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \t\r\n]+$/u;

/** Validates the body of a Customer Message in a Ticket thread. */
export const ticketMessageInput = z.object({
  body: multilineTextField("Message", {
    max: 2_000,
    pattern: ticketTextPattern,
    patternMessage: "Enter a message without invisible characters",
  }),
});

/**
 * Validates the body of a reply. With an image attached the words are optional, so a blank body is accepted and saved
 * as empty text; without an image it must pass the same rules as any Message.
 */
export function parseReplyBody(body: unknown, hasAttachment: boolean) {
  if (hasAttachment && (typeof body !== "string" || body.trim() === "")) {
    return { success: true as const, data: { body: "" } };
  }
  return ticketMessageInput.safeParse({ body });
}
