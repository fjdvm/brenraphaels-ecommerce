"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";

import { completeTicket } from "@/app/(site)/(protected)/support/actions";
import { Button } from "@/components/ui/button";
import { ratingCommentMaximumLength } from "@/lib/support/ticket-rating";

/**
 * Confirms a fix (or completes the Ticket) and offers an optional rating. The rating never blocks confirming:
 * with no stars chosen the same button just confirms. A refusal is shown in plain words and nothing changes.
 */
export function CompleteTicket({ ticketId, label, outline = false }: { ticketId: number; label: string; outline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await completeTicket(ticketId, stars > 0 ? { stars, comment } : undefined);
      if (!result.completed) setMessage(result.message ?? "We couldn't complete this Ticket. Please try again.");
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="pill-sm" type="button" variant={outline ? "pill-outline" : "default"}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 border border-line bg-white p-4 sm:w-[360px]" role="group" aria-label="Confirm and rate">
      <p className="text-sm font-medium tracking-[0.35px] text-ink">How did we do? <span className="font-normal text-muted">(optional)</span></p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-checked={stars === value}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            className="p-0.5 text-primary focus-visible:ring-2 focus-visible:ring-ring"
            key={value}
            onClick={() => setStars(stars === value ? 0 : value)}
            role="radio"
            type="button"
          >
            <Star aria-hidden className="size-6" fill={value <= stars ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      {stars > 0 ? (
        <textarea
          aria-label="Comment"
          className="min-h-20 border border-line px-3 py-2 text-sm tracking-[0.35px]"
          maxLength={ratingCommentMaximumLength}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Anything to add? (optional)"
          value={comment}
        />
      ) : null}
      {message ? <p className="text-sm text-red-700" role="alert">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={confirm} size="pill-sm" type="button">
          {pending ? "Confirming…" : stars > 0 ? "Send rating and confirm" : "Skip and confirm"}
        </Button>
        <Button disabled={pending} onClick={() => setOpen(false)} size="pill-sm" type="button" variant="pill-outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
