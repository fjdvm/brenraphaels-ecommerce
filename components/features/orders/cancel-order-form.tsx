"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { cancelOrder, type OrderCancellationState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";

const initialState: OrderCancellationState = {};

/** The Order card's footer: the cancellation note, a way to message us, and the cancel button until staff dispatch. */
export function CancelOrderForm({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(cancelOrder, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="mr-auto text-xs tracking-[0.35px] text-muted">You can cancel this order until it&apos;s dispatched.</p>
        <MessageUsLink orderId={orderId} />
        <Button disabled={pending} size="pill-sm" type="submit" variant="pill-outline">
          {pending ? "Cancelling…" : "Cancel order"}
        </Button>
      </div>
      {state.message ? <p className="text-sm text-red-700" role="alert">{state.message}</p> : null}
      {state.cancelled ? <p className="text-sm font-medium text-primary" role="status">Order cancelled.</p> : null}
      {state.emailWarning ? <p className="text-sm text-body" role="status">{state.emailWarning}</p> : null}
    </form>
  );
}

export function MessageUsLink({ orderId, label = "Message us about this order" }: { orderId: number; label?: string }) {
  return (
    <Button asChild size="link-sm" variant="link">
      <Link href={`/support/new?order=${orderId}`}>
        {label}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </Button>
  );
}
