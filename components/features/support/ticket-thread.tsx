"use client";

import { useOptimistic, useRef, useState } from "react";

import { sendMessage } from "@/app/(site)/(protected)/support/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { TicketMessage } from "@/lib/support/tickets";
import { ticketMessageInput } from "@/lib/support/ticket-message";

type OptimisticMessage = TicketMessage & { pending?: boolean };

/** Renders a Ticket's thread and appends Customer Messages before the server responds. */
export function TicketThread({ ticketId, messages }: { ticketId: number; messages: TicketMessage[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string>();
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<OptimisticMessage[], OptimisticMessage>(
    messages,
    (currentMessages, optimisticMessage) => [...currentMessages, optimisticMessage],
  );

  async function submit(formData: FormData) {
    const parsed = ticketMessageInput.safeParse({ body: formData.get("body") });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message);
      return;
    }

    formRef.current?.reset();
    setMessage(undefined);
    addOptimisticMessage({
      id: -Date.now(),
      sender: "customer",
      body: parsed.data.body,
      createdAt: new Date(),
      pending: true,
    });
    const state = await sendMessage(ticketId, {}, formData);
    if (state.message) setMessage(state.message);
    if (state.fieldErrors?.body?.[0]) setMessage(state.fieldErrors.body[0]);
  }

  return (
    <div className="mt-8 grid gap-6">
      <ol className="space-y-4" aria-label="Message thread">
        {optimisticMessages.map((threadMessage) => (
          <li className={threadMessage.pending ? "opacity-60" : undefined} key={threadMessage.id}>
            <p className="text-sm font-semibold text-primary">{threadMessage.sender === "customer" ? "You" : "Bren Raphael's Storefront"}</p>
            <p className="mt-1 rounded-md border border-outline-variant/60 bg-surface-card p-4 whitespace-pre-wrap">{threadMessage.body}</p>
          </li>
        ))}
      </ol>
      <form action={submit} className="rounded-md border border-outline-variant/60 bg-surface-card p-5" ref={formRef}>
        <Label htmlFor="ticket-reply" required>Reply</Label>
        <textarea className="mt-1 min-h-32 w-full border border-input bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-ring" id="ticket-reply" maxLength={2_000} name="body" required />
        {message ? <p className="mt-2 text-sm text-red-700" role="alert">{message}</p> : null}
        <Button className="mt-4" type="submit">Send Message</Button>
      </form>
    </div>
  );
}
