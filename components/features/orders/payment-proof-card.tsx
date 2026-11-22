"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { PhotoViewer } from "@/components/ui/photo-viewer";
import { formatPeso } from "@/lib/catalog/currency";
import { formatPlacedAt } from "@/lib/orders/order-view";
import type { CustomerPaymentProof } from "@/lib/orders/orders";
import { checkReceipt, readReceiptText, readScreenshotText, type ReadReceipt } from "@/lib/orders/screenshot-reading";
import { cn } from "@/lib/utils";

/** A saved time as the `datetime-local` text the receipt checks use, in Philippine time. */
function manilaLocal(date: Date) {
  return date.toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T").slice(0, 16);
}

function Tick({ passed, children }: { passed: boolean; children: string }) {
  return (
    <li className={cn("flex items-start gap-2 text-xs", passed ? "text-ink" : "text-red-700")}>
      {passed ? <Check aria-label="Passed" className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={3} /> : <X aria-label="Failed" className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />}
      <span>{children}</span>
    </li>
  );
}

type Reading = { state: "idle" } | { state: "reading"; percent: number } | { state: "done"; receipt: ReadReceipt } | { state: "failed" };

export function PaymentProofCard({
  orderId,
  position,
  proof,
  order,
  awaitingCheck,
  busy,
  onBusyChange,
}: {
  orderId: number;
  position: number;
  proof: CustomerPaymentProof;
  order: { totalInCentavos: number; placedAt: Date };
  /** True while the Order still waits for Staff to check its latest proof. */
  awaitingCheck: boolean;
  /** One card reads at a time. */
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [viewer, setViewer] = useState<number | null>(null);
  const [reading, setReading] = useState<Reading>({ state: "idle" });
  const src = `/api/orders/${orderId}/payment-proofs/${proof.id}`;
  const status = proof.rejection ? "Not accepted" : awaitingCheck ? "Being checked" : "Accepted";

  async function readScreenshot() {
    onBusyChange(true);
    setReading({ state: "reading", percent: 0 });
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("The screenshot could not be loaded.");
      const text = await readScreenshotText(await response.blob(), (percent) => setReading({ state: "reading", percent }));
      setReading({ state: "done", receipt: readReceiptText(text) });
    } catch {
      setReading({ state: "failed" });
    } finally {
      onBusyChange(false);
    }
  }

  const receipt = reading.state === "done" ? reading.receipt : null;
  const ocrChecks = receipt ? checkReceipt(receipt, order) : null;
  const submittedPaidAt = proof.confirmedPaidAt ? manilaLocal(proof.confirmedPaidAt) : undefined;
  const referenceDigits = proof.reference?.replace(/\D/g, "");

  return (
    <article className="flex flex-col gap-4 border border-line bg-white p-5 tracking-[0.35px]" data-testid="payment-proof-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium text-ink">Proof {position}</h2>
          <p className="text-xs text-muted">Sent {formatPlacedAt(proof.submittedAt)}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", proof.rejection ? "bg-red-50 text-red-700" : awaitingCheck ? "bg-surface text-muted" : "bg-lavender-soft text-primary")}>{status}</span>
      </div>

      {proof.hasScreenshot ? (
        <>
          <button aria-label={`Enlarge screenshot of proof ${position}`} className="flex h-64 w-full cursor-zoom-in items-center justify-center bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setViewer(0)} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element -- streamed from our own route */}
            <img alt={`Screenshot of proof ${position}`} className="max-h-full max-w-full object-contain" loading="lazy" src={src} />
          </button>
          <PhotoViewer
            index={viewer}
            items={[{
              key: src,
              caption: `Proof ${position}`,
              // eslint-disable-next-line @next/next/no-img-element
              stage: <img alt={`Screenshot of proof ${position}`} className="max-h-full max-w-full bg-white object-contain" src={src} />,
              // eslint-disable-next-line @next/next/no-img-element
              thumbnail: <img alt="" className="size-full bg-white object-contain" src={src} />,
            }]}
            label={`Proof ${position} screenshot`}
            noun="payment screenshot"
            onIndexChange={setViewer}
          />
        </>
      ) : (
        <div className="flex h-24 items-center justify-center bg-surface text-xs text-muted">No screenshot kept</div>
      )}

      {proof.rejection ? (
        <div className="flex flex-col gap-1 bg-red-50 px-4 py-3" role="status">
          <p className="text-xs font-medium text-red-700">Why it wasn&apos;t accepted</p>
          <p className="text-sm text-ink">{proof.rejection.reason || "No reason was given."}</p>
          <p className="text-xs text-muted">Turned down {formatPlacedAt(proof.rejection.at)}</p>
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted">Reference</dt>
        <dd className="text-right text-ink">{proof.reference ?? "—"}</dd>
        <dt className="text-muted">Paid to</dt>
        <dd className="text-right text-ink">
          {proof.account ? [proof.account.label ?? proof.account.method, proof.account.bankName, proof.account.numberEnding ? `••••${proof.account.numberEnding}` : null].filter(Boolean).join(" · ") : "—"}
        </dd>
        <dt className="text-muted">Amount you entered</dt>
        <dd className="text-right text-ink">{proof.confirmedAmountInCentavos !== null ? formatPeso(proof.confirmedAmountInCentavos) : "—"}</dd>
        <dt className="text-muted">Paid at</dt>
        <dd className="text-right text-ink">{proof.confirmedPaidAt ? formatPlacedAt(proof.confirmedPaidAt) : "—"}</dd>
        <dt className="text-muted">Recipient</dt>
        <dd className="text-right text-ink">{proof.confirmedRecipient ?? "—"}</dd>
      </dl>

      {proof.hasScreenshot ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-ink">Checks</p>
            <button
              className="rounded-full border border-primary px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-lavender-soft disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || reading.state === "reading"}
              onClick={readScreenshot}
              type="button"
            >
              {reading.state === "reading" ? `Reading… ${reading.percent}%` : "Analyze"}
            </button>
          </div>
          {reading.state === "failed" ? <p className="text-xs text-red-700" role="alert">We couldn&apos;t read this screenshot. The shop will still check it.</p> : null}
          {receipt && ocrChecks ? (
            <ul aria-label="What the screenshot says" className="flex flex-col gap-1">
              {receipt.reference ? <Tick passed={Boolean(referenceDigits) && receipt.reference === referenceDigits}>{`Reference ${receipt.reference}${receipt.reference === referenceDigits ? " matches what you entered" : " differs from what you entered"}`}</Tick> : <li className="text-xs text-muted">No reference found</li>}
              {receipt.amountInCentavos !== undefined ? <Tick passed={receipt.amountInCentavos === proof.confirmedAmountInCentavos}>{`Amount ${formatPeso(receipt.amountInCentavos)}${receipt.amountInCentavos === proof.confirmedAmountInCentavos ? " matches what you entered" : " differs from what you entered"}`}</Tick> : <li className="text-xs text-muted">No amount found</li>}
              {ocrChecks.amount ? <Tick passed={ocrChecks.amount.passed}>{ocrChecks.amount.note}</Tick> : null}
              {receipt.paidAt ? <Tick passed={receipt.paidAt === submittedPaidAt}>{`Time ${receipt.paidAt.replace("T", " ")}${receipt.paidAt === submittedPaidAt ? " matches what you entered" : " differs from what you entered"}`}</Tick> : <li className="text-xs text-muted">No time found</li>}
              {ocrChecks.date ? <Tick passed={ocrChecks.date.passed}>{ocrChecks.date.note}</Tick> : null}
            </ul>
          ) : null}
          <p className="text-[11px] text-muted">Read on your device; the image isn&apos;t uploaded. A hint only, the shop checks every payment.</p>
        </div>
      ) : null}
    </article>
  );
}
