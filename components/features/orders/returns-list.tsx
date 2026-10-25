import Link from "next/link";

import { formatPeso } from "@/lib/catalog/currency";
import type { CustomerReturn } from "@/lib/returns/customer-reads";
import { resolutionLabel, returnStatusLabel } from "@/lib/returns/return-view";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

/** The Returns tab: the Customer's Return cards, newest first as given. */
export function ReturnsList({ returns }: { returns: CustomerReturn[] }) {
  if (returns.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[40px] border border-line bg-white p-10 text-body" role="status">
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
      className={cn("flex scroll-mt-24 flex-col gap-4 rounded-[40px] border border-line bg-white p-6 sm:p-10", entry.status === "cancelled" && "opacity-60")}
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
      {entry.declineReason ? (
        <p className="rounded-[3px] bg-warning-soft p-[18px] text-sm text-warning">
          <span className="font-medium">Reason for decline:</span> {entry.declineReason}
        </p>
      ) : null}
      {entry.status === "refunded" && entry.refundProofFileId ? (
        <Link className="text-sm font-medium text-primary underline underline-offset-4" href={`/api/returns/${entry.id}/refund-proof`} target="_blank">
          View refund proof
        </Link>
      ) : null}
    </article>
  );
}
