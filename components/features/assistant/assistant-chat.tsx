"use client";

import { Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import {
  cardOrderId, chipsFor, failureReply, ticketHref,
  type Chip, type PanelCard, type PanelMessage, type PanelReply,
} from "@/lib/assistant/panel";
import { cn } from "@/lib/utils";

const chipStyle = "border border-line px-3 py-1.5 text-xs tracking-[0.35px] text-primary hover:bg-lavender-soft rounded-full";

function OrderCard({ card }: { card: PanelCard }) {
  return (
    <div aria-label={card.title} className="ml-[42px] flex flex-col gap-3 border border-line bg-white p-4" role="group">
      <p className="font-serif text-lg leading-[1.35] text-primary">{card.title}</p>
      <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs tracking-[0.35px]">
        {card.lines.map((line) => (
          <div className="flex gap-2" key={line.label}>
            <dt className="w-[84px] shrink-0 text-muted">{line.label}</dt>
            <dd className="min-w-0 break-words text-ink">
              {/^https?:\/\//.test(line.value) ? (
                <a className="text-primary underline" href={line.value} rel="noreferrer" target="_blank">{line.value}</a>
              ) : (
                line.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The chat: Customer and assistant messages, the system-rendered Order card, the Order picker and the chips. */
export function AssistantChat({ pageOrderId }: { pageOrderId?: number }) {
  const [messages, setMessages] = useState<PanelMessage[]>([
    { id: 0, from: "assistant", text: "Hi! Ask me about your orders, payments or pickup." },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const chatId = useRef<number | undefined>(undefined);
  const nextId = useRef(1);
  // "Check another order" stops the Order page from deciding which Order is meant.
  const [pageOrder, setPageOrderState] = useState(pageOrderId);
  const pageOrderRef = useRef(pageOrderId);
  const setPageOrder = (value: number | undefined) => {
    pageOrderRef.current = value;
    setPageOrderState(value);
  };

  const lastCard = [...messages].reverse().find((message) => message.from === "assistant" && message.card);
  const card = lastCard?.from === "assistant" ? lastCard.card : undefined;
  const orderId = cardOrderId(card) ?? pageOrder;

  async function send(text: string, pickedOrderId?: number) {
    const message = text.trim();
    if (!message || busy) return;
    const id = nextId.current++;
    setMessages((current) => [...current, { id, from: "customer", text: message, status: "sending" }]);
    setDraft("");
    setBusy(true);
    let reply: PanelReply;
    try {
      const response = await fetch("/api/assistant/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, chatId: chatId.current, pageOrderId: pageOrderRef.current, pickedOrderId }),
      });
      reply = response.ok ? ((await response.json()) as PanelReply) : failureReply();
    } catch {
      reply = failureReply();
    }
    if (reply.chatId) chatId.current = reply.chatId;
    setMessages((current) => [
      ...current.map((entry) => (entry.id === id && entry.from === "customer" ? { ...entry, status: "sent" as const } : entry)),
      { id: nextId.current++, from: "assistant", text: reply.text, card: reply.card, choices: reply.choices, ticketButton: reply.ticketButton },
    ]);
    setBusy(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function runChip(chip: Chip) {
    if (chip.kind === "ask") void send(chip.message);
    else if (chip.kind === "pick") {
      setPageOrder(undefined);
      void send("Which of my orders can you check?");
    } else if (chip.kind === "local") {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, from: "customer", text: chip.question, status: "sent" },
        { id: nextId.current++, from: "assistant", text: chip.answer },
      ]);
    }
  }

  return (
    <>
      <div aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4" role="log">
        {messages.map((message) =>
          message.from === "customer" ? (
            <div className="flex flex-col items-end gap-1" key={message.id}>
              <p className="max-w-[85%] bg-primary px-4 py-3 text-sm leading-[1.5] tracking-[0.35px] text-white">{message.text}</p>
              {message.status === "sending" ? <span className="text-xs text-muted">sending...</span> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5" key={message.id}>
              <div className="flex items-end gap-2.5">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    Order assistant
                    <span className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-normal text-primary">AI</span>
                  </span>
                  <p className="border border-line bg-white px-4 py-3 text-sm leading-[1.5] tracking-[0.35px] text-ink">{message.text}</p>
                </div>
              </div>
              {message.card ? <OrderCard card={message.card} /> : null}
              {message.choices?.length ? (
                <ul aria-label="Choose an order" className="ml-[42px] flex flex-col gap-2">
                  {message.choices.map((choice) => (
                    <li key={choice.id}>
                      <button
                        className="w-full border border-line bg-white px-4 py-2.5 text-left text-sm text-primary hover:bg-lavender-soft disabled:opacity-60"
                        disabled={busy}
                        onClick={() => {
                          setPageOrder(choice.id);
                          void send(`Order #${choice.id}`, choice.id);
                        }}
                        type="button"
                      >
                        {choice.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {message.ticketButton ? (
                <Link className={cn(chipStyle, "ml-[42px] self-start bg-primary text-white hover:bg-primary")} href={ticketHref(cardOrderId(message.card) ?? orderId)}>
                  Talk to a teammate
                </Link>
              ) : null}
            </div>
          ),
        )}
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line bg-white px-4 pb-7 pt-3">
        <div className="flex flex-wrap gap-2">
          {chipsFor(orderId, card).map((chip) =>
            chip.kind === "link" ? (
              <Link className={chipStyle} href={chip.href} key={chip.label}>{chip.label}</Link>
            ) : (
              <button className={chipStyle} disabled={busy} key={chip.kind === "pick" ? "pick" : chip.label} onClick={() => runChip(chip)} type="button">
                {chip.kind === "pick" ? "Check another order" : chip.label}
              </button>
            ),
          )}
        </div>
        <form className="flex items-center gap-2 bg-surface-soft py-1.5 pl-3.5 pr-1.5" onSubmit={onSubmit}>
          <input
            aria-label="Ask about an order"
            className="min-w-0 flex-1 bg-transparent text-sm tracking-[0.35px] text-ink outline-none placeholder:text-muted"
            maxLength={500}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about an order…"
            value={draft}
          />
          <button aria-label="Send" className="flex size-9 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50" disabled={busy || !draft.trim()} type="submit">
            <Send aria-hidden className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
