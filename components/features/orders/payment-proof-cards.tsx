"use client";

import { useState } from "react";

import { PaymentProofCard } from "@/components/features/orders/payment-proof-card";
import type { CustomerPaymentProof } from "@/lib/orders/orders";

/** The cards of one Order's proofs; only one card reads its screenshot at a time. */
export function PaymentProofCards({ orderId, proofs, order, awaitingCheck }: {
  orderId: number;
  proofs: CustomerPaymentProof[];
  order: { totalInCentavos: number; placedAt: Date };
  awaitingCheck: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {proofs.map((proof, index) => (
        <PaymentProofCard awaitingCheck={awaitingCheck && index === proofs.length - 1} busy={busy} key={proof.id} onBusyChange={setBusy} order={order} orderId={orderId} position={index + 1} proof={proof} />
      ))}
    </div>
  );
}
