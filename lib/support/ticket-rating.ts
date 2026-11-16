/** The Customer's optional rating when they confirm a fix or complete a Ticket. */
export type TicketRating = { stars: number; comment?: string };
export const ratingCommentMaximumLength = 500;

/**
 * Reads the rating the Customer may have given. A missing or unusable rating is simply no rating, so it can never
 * block confirming; a comment without stars is dropped.
 */
export function readTicketRating(value: unknown): TicketRating | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { stars, comment } = value as { stars?: unknown; comment?: unknown };
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) return undefined;
  const text = typeof comment === "string" ? comment.trim().slice(0, ratingCommentMaximumLength) : "";
  return text ? { stars, comment: text } : { stars };
}

