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
