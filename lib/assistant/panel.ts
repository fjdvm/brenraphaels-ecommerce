/** Pure rules of the Order assistant panel: what the reply shows and which chips offer. Chips only navigate or ask. */

export type PanelCard = { title: string; lines: { label: string; value: string }[] };
export type PanelChoice = { id: number; label: string };
export type PanelReply = {
  chatId?: number;
  outcome: "answered" | "handoff" | "fallback" | "pick_order" | "rejected";
  text: string;
  card?: PanelCard;
  choices?: PanelChoice[];
  ticketButton: boolean;
};

export type PanelMessage =
  | { id: number; from: "customer"; text: string; status: "sending" | "sent" | "failed" }
  | { id: number; from: "assistant"; text: string; card?: PanelCard; choices?: PanelChoice[]; ticketButton?: boolean };

export type Chip =
  | { kind: "link"; label: string; href: string }
  | { kind: "ask"; label: string; message: string }
  | { kind: "local"; label: string; question: string; answer: string }
  | { kind: "pick" };

/** Fixed text for "How do I find the reference?"; no model call, so it can never be wrong because of one. */
export const referenceHelp =
  "In your GCash app, open Transactions and tap your payment. The reference number is the “Ref No.” near the top. Type it in when you submit your payment proof.";

export const fallbackReplyText = "I can't answer that right now. A teammate can help; press “Talk to a teammate”.";

/** The order number shown on a card titled "Order #12", if the reply carries an Order card. */
export function cardOrderId(card?: PanelCard): number | undefined {
  const match = card?.title.match(/^Order #(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

/** True when the card says the Customer still has to send a payment proof (or a new one). */
export function needsPaymentProof(card?: PanelCard): boolean {
  const payment = card?.lines.find((line) => line.label === "Payment")?.value ?? "";
  return /waiting for your payment proof|turned down/.test(payment);
}

export function ticketHref(orderId?: number): string {
  return orderId ? `/support/new?order=${orderId}` : "/support/new";
}

/** The chips under the composer. "Change to pickup" is left out: no such flow exists yet. */
export function chipsFor(orderId: number | undefined, card: PanelCard | undefined): Chip[] {
  const chips: Chip[] = [];
  if (orderId && needsPaymentProof(card)) chips.push({ kind: "link", label: "Submit payment", href: `/profile/orders?order=${orderId}` });
  chips.push({ kind: "pick" });
  chips.push({ kind: "local", label: "How do I find the reference?", question: "How do I find the reference?", answer: referenceHelp });
  chips.push({ kind: "link", label: "Talk to a person", href: ticketHref(orderId) });
  return chips;
}

/** What a failed request shows: the same as a model failure, so the Customer always has the Ticket button. */
export function failureReply(): PanelReply {
  return { outcome: "fallback", text: fallbackReplyText, ticketButton: true };
}

/** What `POST /api/assistant/handoff` returns: the Handoff summary shown to the Customer before anything is sent. */
export type HandoffReply = {
  status: "drafted" | "dropped" | "sent";
  summary: string | null;
  reason: string;
  orderId: number | null;
  ticketId: number | null;
  note?: string;
};

/** The plain reason shown when preparing or sending the Handoff fails. */
export const handoffPrepareFailed = "We couldn't prepare your note. Please try again, or write a few words for our team.";
export const handoffSendFailed = "We couldn't send your note. Nothing was sent. Please try again.";
