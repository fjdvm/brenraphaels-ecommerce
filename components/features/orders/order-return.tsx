"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { ReturnRequestForm } from "@/components/features/orders/return-request-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cancelReturn } from "@/lib/returns/return-client";
import type { ReturnOffer } from "@/lib/returns/return-offers";
import { returnWindow } from "@/lib/returns/return-window";

const clockStepMs = 30_000;
const clockNow = () => Math.floor(Date.now() / clockStepMs) * clockStepMs;
function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, clockStepMs);
  return () => clearInterval(timer);
}

/**
 * A delivered Order's Return controls: the Return button with the time left, the closed-window note, or a
 * Requested Return the Customer can still cancel. The server decides the exact cutoff on submit.
 */
export function OrderReturn({ orderId, offer }: { orderId: number; offer: ReturnOffer }) {
  const router = useRouter();
  // The clock is undefined on the server, so server and browser markup agree; it ticks every 30 seconds.
  const now = useSyncExternalStore(subscribeToClock, clockNow, () => undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [requestedNumber, setRequestedNumber] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [message, setMessage] = useState<string>();

  async function confirmCancel() {
    if (!offer.requested) return;
    setPending(true);
    const result = await cancelReturn(offer.requested.id);
    setPending(false);
    setCancelling(false);
    if (result.ok) {
      setCancelled(true);
      setMessage(undefined);
      router.refresh();
    } else {
      setMessage(result.message);
    }
  }

  if (cancelled) return <p className="text-sm font-medium text-primary" role="status">Return cancelled.</p>;

  if (requestedNumber) {
    return <p className="text-sm font-medium text-primary" role="status">Return {requestedNumber} requested. We will email you once it is reviewed.</p>;
  }

  if (offer.requested) {
    return (
      <>
        <p className="text-sm text-body">Return {offer.requested.number} requested.</p>
        <Button onClick={() => setCancelling(true)} size="pill-sm" type="button" variant="pill-outline">Cancel return</Button>
        {message ? <p className="basis-full text-right text-sm text-red-700" role="alert">{message}</p> : null}
        <Dialog onOpenChange={(open) => !pending && setCancelling(open)} open={cancelling}>
          <DialogContent className="text-center">
            <DialogTitle className="font-serif text-3xl leading-tight text-primary">Cancel this Return?</DialogTitle>
            <DialogDescription className="mt-4 leading-7 text-on-surface-variant">
              Return {offer.requested.number} will be cancelled. If the Return window is still open, you can request a new one.
            </DialogDescription>
            <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <Button disabled={pending} onClick={() => setCancelling(false)} size="lg" type="button" variant="outline">Keep Return</Button>
              <Button disabled={pending} onClick={confirmCancel} size="lg" type="button">{pending ? "Cancelling…" : "Yes, cancel Return"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (offer.deliveredAtMs === null || now === undefined) return null;
  const window = returnWindow(offer.deliveredAtMs, now);
  if (window.state === "closed") return <p className="text-sm text-muted">Return window closed</p>;
  if (!offer.lines.some((line) => line.returnable)) return null;

  return (
    <>
      <span className="text-xs tracking-[0.35px] text-muted">{window.timeLeft}</span>
      <Button onClick={() => setFormOpen(true)} size="pill-sm" type="button" variant="pill-outline">Return items</Button>
      {formOpen ? (
        <ReturnRequestForm
          lines={offer.lines}
          onOpenChange={setFormOpen}
          onRequested={(number) => {
            setFormOpen(false);
            setRequestedNumber(number);
            router.refresh();
          }}
          open
          orderId={orderId}
        />
      ) : null}
    </>
  );
}
