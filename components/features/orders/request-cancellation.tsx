"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CancellationStatus } from "@/lib/orders/cancellation-status";

const REASONS = ["I entered the wrong address", "I ordered by mistake", "It's taking too long", "Other reason"] as const;
const failed = "We couldn't send your request. Please check your connection and try again.";

/**
 * A dispatched Order cannot be cancelled outright: the Customer asks, and a Manager decides. Sending the request emails
 * the team, so the dialog shows its spinner at once and the status changes only when the server confirms.
 */
export function RequestCancellation({ orderId, request }: { orderId: number; request: CancellationStatus | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [other, setOther] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [sent, setSent] = useState(false);

  const status = sent ? "waiting-manager" : request?.status;
  if (status === "waiting-manager") return <p className="text-sm text-body" role="status">Cancellation requested. We&apos;ll email you when a Manager decides.</p>;
  if (status === "approved") return <p className="text-sm text-body" role="status">Cancellation approved. We&apos;re finishing the stock and refund steps.</p>;
  if (status === "cancelled") return <p className="text-sm font-medium text-primary" role="status">Order cancelled.</p>;
  if (status === "declined") {
    return <p className="text-sm text-body" role="status">Cancellation request declined{request?.declineReason ? `: ${request.declineReason}` : "."} Your order is still on its way.</p>;
  }

  const reason = choice === "Other reason" ? other.trim() : choice;

  async function send() {
    setPending(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/orders/${orderId}/cancellation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      if (response.ok) {
        setSent(true);
        setOpen(false);
        router.refresh();
      } else {
        const body = await response.json().catch(() => null);
        setMessage(typeof body?.error === "string" ? body.error : failed);
      }
    } catch {
      setMessage(failed);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
      <p className="mr-auto text-xs tracking-[0.35px] text-muted">Changed your mind? The rider already has your order.</p>
      <Button onClick={() => setOpen(true)} size="pill-sm" type="button" variant="pill-outline">Request cancellation</Button>
      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <DialogContent>
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">Request to cancel order #{orderId}</DialogTitle>
          <DialogDescription className="mt-3 leading-7 text-on-surface-variant">
            Your order is already with the rider, so we can&apos;t cancel it right away. Our team will try to stop the delivery.
          </DialogDescription>
          <ul className="mt-4 list-disc space-y-1 bg-surface px-8 py-4 text-xs text-body">
            <li>If the rider can still bring it back, the order is cancelled and you&apos;re emailed.</li>
            <li>A return trip fee may be charged on your next order.</li>
            <li>If it&apos;s too late, the order arrives as planned and you can request a return.</li>
          </ul>
          <fieldset className="mt-5 flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-ink">Why do you want to cancel?</legend>
            {REASONS.map((value) => (
              <label className={`flex items-center gap-3 border px-4 py-3 text-sm ${choice === value ? "border-primary bg-surface" : "border-outline-variant"}`} key={value}>
                <input checked={choice === value} name="cancel-reason" onChange={() => setChoice(value)} type="radio" />
                {value}
              </label>
            ))}
          </fieldset>
          {choice === "Other reason" ? (
            <textarea aria-label="Tell us why" className="mt-3 w-full border border-outline-variant p-3 text-sm" maxLength={1000} onChange={(e) => setOther(e.target.value)} value={other} />
          ) : null}
          {message ? <p className="mt-3 text-sm text-red-700" role="alert">{message}</p> : null}
          <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button disabled={pending} onClick={() => setOpen(false)} size="lg" type="button" variant="outline">Keep my order</Button>
            <Button aria-busy={pending} disabled={pending || !reason} onClick={send} size="lg" type="button">{pending ? "Sending…" : "Send cancellation request"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
