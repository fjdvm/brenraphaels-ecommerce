import Link from "next/link";

import { formatPeso } from "@/lib/catalog/currency";
import type { CustomerReturn } from "@/lib/returns/customer-reads";
import { refundMethodLabels } from "@/lib/returns/refund-destination";
import { resolutionLabel, returnStatusLabel } from "@/lib/returns/return-view";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

/** The Returns tab: the Customer's Return cards, newest first as given. */
export function ReturnsList({ returns }: { returns: CustomerReturn[] }) {
  if (returns.length === 0) {
    return (
      <div className="flex flex-col gap-2 border border-line bg-white p-10 text-body" role="status">
        <p className="font-serif text-[22px] leading-[1.3] text-primary">No Returns yet</p>
        <p>
          To request a Return, open a delivered Order within 24 hours of delivery and choose Return. Read our{" "}
          <Link className="font-medium text-primary underline underline-offset-4" href="/returns">Return &amp; Refund Policy</Link>{" "}
          first.
        </p>
      </div>
    );
  }
  return returns.map((entry) => <ReturnCard entry={entry} key={entry.id} />);
}

function ReturnCard({ entry }: { entry: CustomerReturn }) {
  return (
    <article
      aria-label={`Return ${entry.number}`}
      className={cn("flex scroll-mt-24 flex-col gap-4 border border-line bg-white p-6 sm:p-10", entry.status === "cancelled" && "opacity-60")}
      id={`return-${entry.id}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">{entry.number}</h2>
        <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">{returnStatusLabel(entry.status)}</span>
      </div>
      <p className="text-xs tracking-[0.35px] text-muted">
        <span>Order #{entry.orderId}</span> · Requested {dateFormat.format(entry.requestedAt)}
      </p>
      <ul className="flex flex-col gap-1 text-sm tracking-[0.35px] text-ink">
        {entry.items.map((item) => (
          <li className="flex justify-between gap-4" key={`${item.productName}-${item.sizeLabel}`}>
            <span>{item.productName} · {item.sizeLabel} × {item.quantity}</span>
            <span>{formatPeso(item.priceInCentavos * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm tracking-[0.35px] text-body">
        Preferred: {resolutionLabel(entry.preferredResolution)} · Final: {entry.finalResolution ? resolutionLabel(entry.finalResolution) : "Awaiting decision"}
      </p>
      {entry.refundDestination ? (
        <p className="text-sm tracking-[0.35px] text-body" data-testid={`refund-destination-${entry.id}`}>
          Refund to: {refundMethodLabels[entry.refundDestination.method]}
          {entry.refundDestination.bankName ? ` · ${entry.refundDestination.bankName}` : ""} · {entry.refundDestination.accountName} · {entry.refundDestination.accountNumber}
        </p>
      ) : null}
      {entry.declineReason ? (
        <p className="bg-warning-soft p-[18px] text-sm text-warning">
          <span className="font-medium">Reason for decline:</span> {entry.declineReason}
        </p>
      ) : null}
      {entry.refund ? (
        <dl className="flex flex-col gap-1 border border-line bg-lavender-soft p-[18px] text-sm tracking-[0.35px] text-body" data-testid={`refund-record-${entry.id}`}>
          {entry.refund.deliveryFeeInCentavos > 0 ? <RefundRow label="Delivery fee" value={formatPeso(entry.refund.deliveryFeeInCentavos)} /> : null}
          <RefundRow label="Refund amount" value={formatPeso(entry.refund.amountInCentavos)} strong />
          <RefundRow label="Method" value={refundMethodLabels[entry.refund.method]} />
          <RefundRow label="Date sent" value={dateFormat.format(new Date(`${entry.refund.paidOn}T00:00:00+08:00`))} />
          <RefundRow label="Reference" value={entry.refund.reference} />
        </dl>
      ) : null}
      {entry.status === "refunded" && entry.refundProofFileId ? (
        <Link className="text-sm font-medium text-primary underline underline-offset-4" href={`/api/returns/${entry.id}/refund-proof`} target="_blank">
          View refund proof
        </Link>
      ) : null}
    </article>
  );
}

function RefundRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className={strong ? "font-medium text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
