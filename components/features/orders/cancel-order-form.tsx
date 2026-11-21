"use client";

import { useActionState, useState, useTransition } from "react";

import { cancelOrder, withdrawCancelRequest, type OrderCancellationState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import type { CancelRequestView } from "@/lib/orders/cancel-requests";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const initialState: OrderCancellationState = {};
export const CANCEL_REASONS = ["I entered the wrong address", "I ordered by mistake", "I want to change my order", "Other reason"] as const;

/**
 * The Order card's footer: "Cancel order" opens a dialog asking why and sends a request. A person at the shop approves it, so the
 * Order stays as it is until then; the Customer can withdraw a waiting request. `defaultOpen` lets a "Cancel order" link open the dialog.
 */
export function CancelOrderForm({ orderId, defaultOpen = false, request = null }: { orderId: number; defaultOpen?: boolean; request?: CancelRequestView | null }) {
  const [state, action, pending] = useActionState(cancelOrder, initialState);
  const [open, setOpen] = useState(defaultOpen);
  const [choice, setChoice] = useState<(typeof CANCEL_REASONS)[number]>(CANCEL_REASONS[0]);
  const [other, setOther] = useState("");
  const reason = choice === "Other reason" ? other.trim() : choice;
  const [withdrawing, startWithdraw] = useTransition();
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const waiting = !withdrawn && (state.requested === true || request?.status === "waiting");
  const declined = !state.requested && request?.status === "declined" ? request : null;
  const withdraw = () => startWithdraw(async () => {
    setWithdrawMessage(null);
    const result = await withdrawCancelRequest(orderId);
    if (result.ok) setWithdrawn(true); else setWithdrawMessage(result.message);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="mr-auto text-xs tracking-[0.35px] text-muted">{waiting ? "Your cancellation request is waiting for the shop to review it. Your order stays as it is until then." : "You can ask to cancel this order until the shop starts preparing it. The shop reviews every request."}</p>
        {waiting ? (
          <Button aria-busy={withdrawing} disabled={withdrawing} onClick={withdraw} size="pill-sm" type="button" variant="pill-outline">{withdrawing ? "Withdrawing…" : "Withdraw request"}</Button>
        ) : (
          <Button onClick={() => { setWithdrawn(false); setOpen(true); }} size="pill-sm" type="button" variant="pill-outline">Cancel order</Button>
        )}
      </div>
      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open && !waiting}>
        <DialogContent>
          <form action={action}>
            <input name="orderId" type="hidden" value={orderId} />
            <input name="reason" type="hidden" value={reason} />
            <DialogTitle className="font-serif text-3xl leading-tight text-primary">Ask to cancel order #{orderId}?</DialogTitle>
            <DialogDescription className="mt-3 leading-7 text-on-surface-variant">Tell us why you need to cancel. The shop will review your request and email you its decision. Your order is not cancelled until then.</DialogDescription>
            <fieldset className="mt-5 flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Why do you want to cancel?</legend>
              {CANCEL_REASONS.map((value) => (
                <label className={`flex items-center gap-3 border px-4 py-3 text-sm ${choice === value ? "border-primary bg-surface" : "border-outline-variant"}`} key={value}>
                  <input checked={choice === value} name="cancel-reason" onChange={() => setChoice(value)} type="radio" />
                  {value}
                </label>
              ))}
            </fieldset>
            {choice === "Other reason" ? (
              <textarea aria-label="Tell us why" className="mt-3 w-full border border-outline-variant p-3 text-sm" maxLength={1000} onChange={(e) => setOther(e.target.value)} value={other} />
            ) : null}
            {state.message ? <p className="mt-3 text-sm text-red-700" role="alert">{state.message}</p> : null}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button disabled={pending} onClick={() => setOpen(false)} size="lg" type="button" variant="outline">Keep my order</Button>
              <Button aria-busy={pending} disabled={pending || !reason} size="lg" type="submit">{pending ? "Sending…" : "Send request"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {waiting ? <p className="text-sm font-medium text-primary" role="status">Cancellation requested. We will email you the decision.</p> : null}
      {declined && !waiting ? <p className="text-sm text-body" role="status">Your last request was declined{declined.decidedByName ? ` by ${declined.decidedByName}` : ""}: {declined.declineReason}. Your order carries on.</p> : null}
      {withdrawMessage ? <p className="text-sm text-red-700" role="alert">{withdrawMessage}</p> : null}
    </div>
  );
}
