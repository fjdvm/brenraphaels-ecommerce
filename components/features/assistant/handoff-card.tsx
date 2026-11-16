"use client";

import { Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { handoffSendFailed, type HandoffReply } from "@/lib/assistant/panel";

export type HandoffPhase =
  | { kind: "preparing" }
  | { kind: "review"; draft: HandoffReply }
  | { kind: "sent"; ticketId: number };

const buttonStyle = "px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] disabled:opacity-60 rounded-full";
const maxLength = 1_000;

/**
 * The Handoff step. The Customer sees the summary first and nothing reaches the team until they press "Send to our team";
 * they can edit it, write their own when it was dropped, or cancel. A failed send puts the card back with the reason.
 */
export function HandoffCard({ chatId, phase, onCancel, onSent }: {
  chatId: number;
  phase: HandoffPhase;
  onCancel: () => void;
  onSent: (ticketId: number) => void;
}) {
  const draft = phase.kind === "review" ? phase.draft : undefined;
  const [text, setText] = useState(draft?.summary ?? "");
  const [editing, setEditing] = useState(draft ? draft.summary === null : false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  if (phase.kind === "preparing") {
    return (
      <div aria-busy="true" aria-label="Preparing your note for our team" className="ml-[42px] flex w-[310px] max-w-full items-center gap-2.5 border border-accent bg-lavender-soft p-4 text-xs tracking-[0.35px] text-body" role="status">
        <Loader2 aria-hidden className="size-4 animate-spin text-primary" />
        Writing a short note for our team…
      </div>
    );
  }

  if (phase.kind === "sent") {
    return (
      <div aria-label="Ticket opened" className="ml-[42px] flex w-[310px] max-w-full flex-col gap-3 border border-accent bg-lavender-soft p-4" role="group">
        <p className="text-sm font-medium tracking-[0.35px] text-ink">Ticket #{phase.ticketId} opened</p>
        <p className="text-xs leading-[1.5] tracking-[0.35px] text-body">Our team has your note. You&apos;ll get a notification when they reply.</p>
        <Link className={`${buttonStyle} self-start bg-primary text-white`} href={`/support/${phase.ticketId}`}>Open ticket</Link>
      </div>
    );
  }

  const trimmed = text.trim();
  const dropped = draft?.summary === null;

  async function send() {
    if (sending || !trimmed) return;
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/assistant/handoff/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // An unedited summary is sent as is; only the Customer's own words travel as text.
        body: JSON.stringify({ chatId, summary: editing || dropped ? trimmed : undefined }),
      });
      const body = (await response.json().catch(() => ({}))) as { ticketId?: number; error?: string };
      if (response.ok && body.ticketId) {
        onSent(body.ticketId);
        return;
      }
      setError(body.error ?? handoffSendFailed);
    } catch {
      setError(handoffSendFailed);
    }
    setSending(false);
  }

  return (
    <div aria-label="Hand off to our team" className="ml-[42px] flex w-[310px] max-w-full flex-col gap-3 border border-accent bg-lavender-soft p-4" role="group">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-white text-primary"><MessageCircle className="size-4" /></span>
        <div className="flex flex-col">
          <p className="text-sm font-medium tracking-[0.35px] text-ink">Send this to our team?</p>
          <p className="text-xs tracking-[0.35px] text-primary">Nothing is sent until you press Send</p>
        </div>
      </div>
      {draft?.note ? <p className="text-xs leading-[1.5] tracking-[0.35px] text-body">{draft.note}</p> : null}
      {editing ? (
        <label className="flex flex-col gap-1.5 text-xs tracking-[0.35px] text-muted">
          Your note for our team
          <textarea
            className="min-h-24 border border-line bg-white p-2.5 text-sm leading-[1.5] text-ink outline-none"
            maxLength={maxLength}
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </label>
      ) : (
        <p className="whitespace-pre-wrap break-words border border-line bg-white p-2.5 text-sm leading-[1.5] tracking-[0.35px] text-ink">{draft?.summary}</p>
      )}
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={`${buttonStyle} bg-primary text-white`} disabled={sending || !trimmed} onClick={send} type="button">
          {sending ? "Sending…" : "Send to our team"}
        </button>
        {!editing && !dropped ? (
          <button className={`${buttonStyle} border border-primary text-primary`} disabled={sending} onClick={() => { setText(draft?.summary ?? ""); setEditing(true); }} type="button">Edit</button>
        ) : null}
        <button className={`${buttonStyle} text-primary`} disabled={sending} onClick={onCancel} type="button">Cancel</button>
      </div>
    </div>
  );
}
