import { z } from "zod";

import { multilineTextField, positiveIntegerField } from "../validators/fields";

const feedbackTextPattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \t\r\n]+$/u;

export const orderFeedbackInput = z.object({
  orderId: positiveIntegerField("Order ID"),
  rating: positiveIntegerField("Rating", {
    max: 5,
    message: "Choose a rating from 1 to 5",
  }),
  comment: multilineTextField("Comment", {
    max: 2_000,
    pattern: feedbackTextPattern,
    patternMessage: "Enter text without invisible characters",
  }),
});
