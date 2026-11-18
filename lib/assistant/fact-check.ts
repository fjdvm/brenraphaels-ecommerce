const statuses = ["placed", "confirmed", "awaiting payment", "paid", "preparing", "dispatched", "delivered", "ready for pickup", "collected", "received", "cancelled"];

const monthDate = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?/gi;
const numericDate = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;
const clock = /\b\d{1,2}:\d{2}\s?(?:am|pm)?/gi;
const url = /https?:\/\/[^\s)]+/gi;
const peso = /(?:₱|php\s?|\bpiso\b)\s?[\d,]+(?:\.\d+)?/gi;
const orderRef = /(?:#|order\s*(?:no\.?|number)?\s*)(\d{1,9})\b/gi;
const promise = /refund|replac|discount|voucher|compensat|guarantee|free of charge|libre/i;
/**
 * For a Handoff summary, which has to be able to say what the Customer asked for ("asked for a refund"): only language that
 * promises or suggests an outcome counts, such as "will be refunded", "we can replace" or "entitled to a discount".
 */
const handoffPromise = new RegExp([
  "guarantee|free of charge|libre|promis|rest assured|entitled|eligible|deserve",
  "\\b(?:will|would|should|shall|can|could|may|going to|'ll)\\s+(?:also\\s+|then\\s+|likely\\s+)?(?:be\\s+)?(?:fully\\s+)?(?:refund|replac|credit|compensat|reimburs|discount)",
  "\\b(?:we|team|shop|store|staff)\\b[^.]{0,40}\\b(?:refund|replac|compensat|reimburs)(?:e|es|ed|ing)?\\b",
  "\\b(?:full|a|the)\\s+refund\\s+(?:is|will|has|within)|\\b(?:within|by)\\s+\\d+\\s+(?:business\\s+)?days?",
].join("|"), "i");

/**
 * Compares the model's answer with the records. Every date, time, link, peso amount and Order number it states must
 * come from the facts it was given, it may not name a different status, and it may not promise anything.
 * Returns the first problem, or undefined when the answer is consistent.
 */
/** Models and Intl write a time as "3:45 PM" with a no-break or narrow no-break space; to the Customer it is the same text. */
const normalise = (value: string) => value.replace(/[\s\u00a0\u202f]+/g, " ");

export function factCheck(answer: string, facts: { text: string; orderId?: number; status?: string; kind?: "answer" | "handoff" }): string | undefined {
  const text = normalise(answer).trim();
  if (!text) return "empty answer";
  if (text.length > 900) return "answer too long";
  const known = normalise(facts.text).toLowerCase();
  for (const pattern of [monthDate, numericDate, clock, url, peso]) {
    for (const match of text.match(pattern) ?? []) {
      if (!known.includes(match.replace(/[.,]$/, "").toLowerCase())) return `not in the records: ${match}`;
    }
  }
  for (const match of text.matchAll(orderRef)) {
    if (facts.orderId === undefined || Number(match[1]) !== facts.orderId) return `another order: ${match[0]}`;
  }
  if ((facts.kind === "handoff" ? handoffPromise : promise).test(text)) return "promise";
  if (facts.status) {
    for (const other of statuses.filter((status) => status !== facts.status)) {
      if (new RegExp(`\\b(?:has been|have been|is|was|already|been|are now)\\s+${other}\\b(?!\\s+(?:on|at|by|via|in|with|through|from)\\b)`, "i").test(text)) return `wrong status: ${other}`;
    }
  }
  return undefined;
}
