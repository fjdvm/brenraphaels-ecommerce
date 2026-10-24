"use client";

import { useState, useTransition } from "react";

import { markOrderReceived } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Lets the Customer confirm a delivered Order arrived. The confirmation is irreversible, so the dialog
 * says plainly that it ends their right to a Return; the server refreshes the card once it succeeds.
 */
export function OrderReceivedButton({ orderId }: { orderId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string>();
  const [received, setReceived] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await markOrderReceived(orderId).catch(() => ({
        received: false,
        message: "We couldn't mark this Order received. Please try again.",
      }));
      setConfirming(false);
      setReceived(Boolean(result.received));
      setMessage(result.received ? undefined : result.message);
    });
  }

  if (received) return <p className="text-sm font-medium text-primary" role="status">Order marked as received.</p>;

  return (
    <>
      <Button onClick={() => setConfirming(true)} size="pill-sm" type="button" variant="pill-outline">
        I received my order
      </Button>
      {message ? <p className="basis-full text-right text-sm text-red-700" role="alert">{message}</p> : null}

      <Dialog onOpenChange={(open) => !pending && setConfirming(open)} open={confirming}>
        <DialogContent className="text-center">
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">Confirm you received this Order?</DialogTitle>
          <DialogDescription className="mt-4 leading-7 text-on-surface-variant">
            Once you confirm, you will no longer be able to return this Order or ask for a refund. This cannot be undone.
          </DialogDescription>
          <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <Button disabled={pending} onClick={() => setConfirming(false)} size="lg" type="button" variant="outline">Go back</Button>
            <Button disabled={pending} onClick={confirm} size="lg" type="button">{pending ? "Confirming…" : "Yes, I received it"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
