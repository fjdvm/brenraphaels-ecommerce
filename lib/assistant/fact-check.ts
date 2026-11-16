const statuses = ["placed", "confirmed", "awaiting payment", "paid", "preparing", "dispatched", "delivered", "received", "cancelled"];

const monthDate = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?/gi;
const numericDate = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;
const clock = /\b\d{1,2}:\d{2}\s?(?:am|pm)?/gi;
const url = /https?:\/\/[^\s)]+/gi;
const peso = /(?:₱|php\s?|\bpiso\b)\s?[\d,]+(?:\.\d+)?/gi;
const orderRef = /(?:#|order\s*(?:no\.?|number)?\s*)(\d{1,9})\b/gi;
const promise = /refund|replac|discount|voucher|compensat|guarantee|free of charge|libre/i;

/**
 * Compares the model's answer with the records. Every date, time, link, peso amount and Order number it states must
 * come from the facts it was given, it may not name a different status, and it may not promise anything.
 * Returns the first problem, or undefined when the answer is consistent.
 */
export function factCheck(answer: string, facts: { text: string; orderId?: number; status?: string }): string | undefined {
  const text = answer.trim();
  if (!text) return "empty answer";
  if (text.length > 900) return "answer too long";
  const known = facts.text.toLowerCase();
  for (const pattern of [monthDate, numericDate, clock, url, peso]) {
    for (const match of text.match(pattern) ?? []) {
      if (!known.includes(match.replace(/[.,]$/, "").toLowerCase())) return `not in the records: ${match}`;
    }
  }
  for (const match of text.matchAll(orderRef)) {
    if (facts.orderId === undefined || Number(match[1]) !== facts.orderId) return `another order: ${match[0]}`;
  }
  if (promise.test(text)) return "promise";
  if (facts.status) {
    for (const other of statuses.filter((status) => status !== facts.status)) {
      if (new RegExp(`\\b(?:has been|have been|is|was|already|been|are now)\\s+${other}\\b`, "i").test(text)) return `wrong status: ${other}`;
    }
  }
  return undefined;
}
