/** Every number, cap and list of the Order assistant is fixed here. There are no Admin settings and no kill switch. */

/** Messages one Customer may send per day (Manila time). */
export const dailyMessageCap = 30;
/** Model calls the whole assistant may make per day; a budget separate from the Staff features in CREOMS. */
export const dailyModelBudget = 1_000;
export const maxMessageLength = 500;
/** Chats not attached to a Ticket are deleted after this many days. */
export const chatRetentionDays = 90;
/** How many earlier turns the model sees. */
export const historyTurns = 6;
/** How many recent Orders the picker offers. */
export const pickerSize = 5;
/** The Delivery fee is quoted by hand, so the assistant only ever gives this range. */
export const deliveryFeeRange = { fromPesos: 100, toPesos: 300 };

export type HandoffReason =
  | "damaged_or_spoiled"
  | "wrong_item"
  | "refund"
  | "discount"
  | "replacement"
  | "food_safety"
  | "person_requested"
  | "upset"
  | "outside_scope"
  | "no_matching_order"
  | "fact_check_failed";

/** Things a person always answers; the assistant never replies to them, in English or Taglish. */
const handoffPatterns: { reason: HandoffReason; pattern: RegExp }[] = [
  { reason: "food_safety", pattern: /food poison|allerg|nagka[- ]?(sakit|diarrhea)|sumakit ang tiyan|sumakit|nasuka|nag[- ]?suka|diarrhea|\bsick\b|hospital|ospital|rash|safe to eat|ligtas kainin|pagkalason/i },
  { reason: "damaged_or_spoiled", pattern: /damag|spoil|spoilt|expired|rotten|bulok|panis|\bamag\b|moldy|mold\b|nasira|sira\b|basag|durog|tumagas|leak|broken|crushed|mabaho|smells? (bad|off|funny)|mukhang sira/i },
  { reason: "wrong_item", pattern: /wrong (item|order|product|flavou?r|size)|maling|mali ang|incorrect|not what i ordered|missing item|kulang ang|hindi ito ang inorder/i },
  { reason: "refund", pattern: /refund|money back|ibalik (ang|yung) (pera|bayad)|pera ko|chargeback/i },
  { reason: "replacement", pattern: /replac|ipalit|palit\b|papalitan/i },
  { reason: "discount", pattern: /discount|promo|voucher|coupon|bawas|freebie|sale price|cheaper|mas mura/i },
  { reason: "person_requested", pattern: /(talk|speak|chat|connect)\s+(to|with)\s+(a |an |the |your )?(real |live )?(person|human|agent|teammate|staff|someone|representative|manager)|real person|live agent|human agent|customer service|kausapin|kausap ko|tao\b|makausap/i },
  { reason: "upset", pattern: /angry|galit|furious|disappointed|worst|scam|ridiculous|unacceptable|nakakainis|reklamo|complain|nakakagalit|walang kwenta/i },
];

/** The first always-handoff kind the message touches, or undefined. Checked in this order: safety first. */
export function handoffReasonFor(message: string): HandoffReason | undefined {
  return handoffPatterns.find(({ pattern }) => pattern.test(message))?.reason;
}

export type QuestionKind =
  | "order_status"
  | "payment"
  | "return_window"
  | "delivery_fee"
  | "shop_info"
  | "shop_rules"
  | "product";

/** Kinds that are about one of the Customer's Orders. */
export const orderKinds: readonly QuestionKind[] = ["order_status", "payment", "return_window"];

const kindPatterns: { kind: QuestionKind; pattern: RegExp }[] = [
  { kind: "product", pattern: /ingredient|sangkap|storage|store it|keep it|refrigerat|ref\b|shelf|tumatagal|how long (does|will|can)|gaano katagal|best before|expir/i },
  { kind: "delivery_fee", pattern: /delivery fee|shipping|shipping fee|magkano (ang )?(delivery|shipping)|how much (is|for) (the )?delivery|rate ng delivery|delivery rate|bayad sa delivery/i },
  { kind: "return_window", pattern: /\breturn(s)?\b|ibabalik|still (request|return)/i },
  { kind: "payment", pattern: /\bpay(ment|ing|\b)|gcash|maya|bank transfer|proof|reference number|bayad|\bpaid\b|\bcod\b|cash on delivery/i },
  { kind: "shop_rules", pattern: /cancel|policy|rules?|free delivery|free shipping|minimum|payment methods?|how do i (order|pay)|paano (mag-?order|magbayad)/i },
  { kind: "order_status", pattern: /where('| i)?s? (is )?my|track|status|dispatch|deliver|rider|courier|lalamove|grab|\beta\b|arrive|when (will|is|does)|asan na|nasaan|kailan|dumating|order|pickup ready|ready for pick/i },
  { kind: "shop_info", pattern: /pick ?up|opening|open (on|at|today|until)|hours|schedule|closed|sunday|address|location|where (is|are) (the |your )?(store|shop)|saan (kayo|ang tindahan)|oras ng/i },
];

/** What the message is asking, or undefined when it is none of the recognised kinds. */
export function questionKindOf(message: string): QuestionKind | undefined {
  return kindPatterns.find(({ pattern }) => pattern.test(message))?.kind;
}

/** An Order number typed in the message: "#123", "order 123", "order no. 123". */
export function typedOrderNumber(message: string): number | undefined {
  const match = message.match(/(?:#|order\s*(?:no\.?|number|num\.?|id)?\s*#?\s*)(\d{1,9})\b/i);
  const value = match ? Number(match[1]) : undefined;
  return value && value > 0 && value <= 2_147_483_647 ? value : undefined;
}

/** Emails and phone numbers never leave the system; long digit runs (cards, phones) are masked too. */
export function maskContact(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/(\+?63|0)[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "[phone]")
    .replace(/\d[\d\s-]{8,}\d/g, "[number]");
}
