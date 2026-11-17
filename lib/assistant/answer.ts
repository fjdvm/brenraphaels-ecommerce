import { startOfShopDay, type ChatStore, type StoredTurn } from "./chat-store";
import { factCheck } from "./fact-check";
import { formatWhen, orderCard, orderFactsText, shopFact, type AssistantOrder, type Card } from "./facts";
import { assistantSystemPrompt, type Completer, type ModelMessage } from "./model";
import {
  dailyMessageCap, dailyModelBudget, handoffReasonFor, historyTurns, maskContact, maxMessageLength, orderKinds, pickerSize,
  questionKindOf, typedOrderNumber, type HandoffReason, type QuestionKind,
} from "./policy";
import type { OrderReader, ProductReader } from "./readers";

export type OrderChoice = { id: number; label: string };

export type AssistantReply = {
  /** Absent only when the message was rejected before anything was stored. */
  chatId?: number;
  outcome: "answered" | "handoff" | "fallback" | "pick_order" | "rejected";
  reason?: HandoffReason | "daily_cap" | "model_unavailable" | "model_budget" | "too_long" | "empty" | "unknown_detail";
  /** What the Customer reads: the model's words around the facts, or a fixed sentence. */
  text: string;
  /** The facts, written by our code from the records. */
  card?: Card;
  /** The Orders to pick from when the Customer has several and did not say which. */
  choices?: OrderChoice[];
  /** Show "Talk to a teammate": the way to a Ticket with the Handoff summary. */
  ticketButton: boolean;
};

export type AssistantInput = {
  customerId: string;
  message: string;
  chatId?: number;
  /** The Order page the chat was opened from. */
  pageOrderId?: number;
  /** The Order the Customer chose in the picker. */
  pickedOrderId?: number;
};

export type AssistantDependencies = {
  orders: OrderReader;
  products: ProductReader;
  chats: ChatStore;
  complete: Completer;
  now?: Date;
};

const handoffText = "I can't help with this one, but a teammate can. Press “Talk to a teammate” and we will pick it up.";
const noOrderText = "I couldn't find that order on your account. Choose one of your orders, or talk to a teammate.";
const fallbackText = "I can't answer that right now. Here is what I can see, and a teammate can help with the rest.";
const generalFacts = "No order or shop records are attached to this message. Do not state anything about a specific order, date, amount or delivery.";
const capText = "You've reached today's limit of messages to the assistant. Here is what I can see, and a teammate can help from here.";

const handoffTexts: Partial<Record<HandoffReason, string>> = {
  damaged_or_spoiled: "I'm sorry about that. A teammate needs to look into it, so please press “Talk to a teammate” and share a photo there.",
  food_safety: "Your health matters. Please stop eating the product and press “Talk to a teammate” right away so a person can follow up.",
  person_requested: "Of course. Press “Talk to a teammate” and a person will take over.",
  no_matching_order: noOrderText,
};

function orderLabel(order: AssistantOrder): string {
  return `Order #${order.id} · ${order.status} · ${formatWhen(order.createdAt)}`;
}

/**
 * Answers one Customer message about their own Orders and the shop. Our code picks the Order (only ever from the
 * Customer's own), renders the facts and decides every handoff; the model only words the reply around the facts,
 * and a fact check against the records stands between it and the Customer. Nothing here can change an Order.
 */
export async function answerOrderQuestion(input: AssistantInput, deps: AssistantDependencies): Promise<AssistantReply> {
  const now = deps.now ?? new Date();
  const message = input.message.trim();
  if (message.length === 0) return { outcome: "rejected", reason: "empty", text: "Type your question first.", ticketButton: false };
  if (message.length > maxMessageLength) {
    return { outcome: "rejected", reason: "too_long", text: `Please keep your message under ${maxMessageLength} characters.`, ticketButton: false };
  }

  const chatId = await deps.chats.chatFor(input.customerId, input.chatId);
  const history = await deps.chats.recentTurns(chatId, historyTurns);
  const customerTurn: StoredTurn = { sender: "customer", body: message };

  async function finish(reply: Omit<AssistantReply, "chatId">, extra: { orderId?: number; sentToModel?: string } = {}): Promise<AssistantReply> {
    await deps.chats.save(chatId, [
      customerTurn,
      { sender: "assistant", body: reply.text, outcome: reply.outcome === "rejected" ? "fallback" : reply.outcome, reason: reply.reason ?? null, orderId: extra.orderId, sentToModel: extra.sentToModel },
    ]);
    return { ...reply, chatId };
  }

  /** The Customer's own Order named by the typed number, the picker or the page; undefined for any id that is not theirs. */
  async function requestedOrder(): Promise<{ asked: boolean; order?: AssistantOrder }> {
    const id = typedOrderNumber(message) ?? input.pickedOrderId ?? input.pageOrderId;
    if (id === undefined) return { asked: false };
    return { asked: true, order: await deps.orders.findOwn(input.customerId, id) };
  }

  // The daily cap holds before anything else, even the handoffs, so the cost stays bounded.
  const sentToday = await deps.chats.messagesSentSince(input.customerId, startOfShopDay(now));
  if (sentToday >= dailyMessageCap) {
    const { order } = await requestedOrder();
    return finish({ outcome: "fallback", reason: "daily_cap", text: capText, card: order ? orderCard(order, now) : undefined, ticketButton: true }, { orderId: order?.id });
  }

  const handoff = handoffReasonFor(message);
  // A handoff remembers the Customer's own Order the chat was about, so the Ticket can link it.
  if (handoff) {
    const { order } = await requestedOrder();
    return finish({ outcome: "handoff", reason: handoff, text: handoffTexts[handoff] ?? handoffText, ticketButton: true }, { orderId: order?.id });
  }

  const kind = questionKindOf(message);

  if (kind === "product") {
    const product = await deps.products.findMentioned(message);
    const wanted = /ingredient|sangkap/i.test(message) ? /ingredient/i : /storage|shelf|keep|ref|tumatagal|how long|katagal|best before|expir/i.test(message) ? /storage|shelf/i : undefined;
    const sections = product && wanted ? product.sections.filter((section) => wanted.test(section.heading)) : [];
    if (!product || sections.length === 0) {
      return finish({ outcome: "answered", reason: "unknown_detail", text: "I don't know that. It isn't in the product's listed details, so a teammate can help.", ticketButton: true });
    }
    const card: Card = { title: product.name, lines: sections.map((section) => ({ label: section.heading, value: section.lines.join("; ") })) };
    return finish({ outcome: "answered", text: card.lines.map((line) => `${line.label}: ${line.value}`).join(" "), card, ticketButton: false });
  }

  let order: AssistantOrder | undefined;
  let card: Card | undefined;
  let factsText: string;
  if (!kind) {
    // Small talk, follow-ups and anything that is not one of the recognised kinds: the model chats and judges the scope itself,
    // with no records attached, so the fact check holds it to stating no order, date, amount or promise.
    factsText = generalFacts;
  } else if ((orderKinds as readonly QuestionKind[]).includes(kind)) {
    const requested = await requestedOrder();
    if (requested.asked) {
      order = requested.order;
    } else {
      const recent = await deps.orders.listRecent(input.customerId, pickerSize);
      if (recent.length > 1) {
        return finish({
          outcome: "pick_order", text: "Which order do you mean?", choices: recent.map((recentOrder) => ({ id: recentOrder.id, label: orderLabel(recentOrder) })), ticketButton: false,
        });
      }
      order = recent[0];
    }
    // A number that is not theirs and one that does not exist take this same path.
    if (!order) return finish({ outcome: "handoff", reason: "no_matching_order", text: noOrderText, ticketButton: true });
    card = orderCard(order, now);
    factsText = orderFactsText(order, now);
  } else {
    factsText = shopFact(kind) ?? "";
    card = { title: "Shop information", lines: [{ label: kind === "delivery_fee" ? "Delivery fee" : kind === "shop_info" ? "Pickup" : "Shop rules", value: factsText }] };
  }

  const fallback = (reason: "model_unavailable" | "model_budget"): Promise<AssistantReply> =>
    finish({ outcome: "fallback", reason, text: fallbackText, card, ticketButton: true }, { orderId: order?.id });

  if ((await deps.chats.modelCallsSince(startOfShopDay(now))) >= dailyModelBudget) return fallback("model_budget");

  const modelMessages: ModelMessage[] = [
    { role: "system", content: assistantSystemPrompt },
    ...history.map((turn): ModelMessage => ({ role: turn.sender === "customer" ? "user" : "assistant", content: maskContact(turn.body) })),
    { role: "user", content: `FACTS:\n${factsText}\n\nQUESTION: ${maskContact(message)}` },
  ];
  const sentToModel = JSON.stringify(modelMessages);

  let answer: string;
  try {
    answer = await deps.complete(modelMessages);
  } catch {
    // Nothing was sent when no model could be reached, so nothing is recorded as sent.
    return fallback("model_unavailable");
  }

  const problem = factCheck(answer, { text: factsText, orderId: order?.id, status: order?.status });
  if (problem) {
    return finish({ outcome: "fallback", reason: "fact_check_failed", text: fallbackText, card, ticketButton: true }, { orderId: order?.id, sentToModel });
  }
  return finish({ outcome: "answered", text: answer.trim(), card, ticketButton: false }, { orderId: order?.id, sentToModel });
}
