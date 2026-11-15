import type { PaymentDetail } from "@/lib/orders/payment-details";

/** Where to send the payment for one method, as the shop has set it. */
export function PaymentDetailsCard({ detail }: { detail: PaymentDetail | undefined }) {
  if (!detail) return null;

  return (
    <div className="flex flex-col gap-2 border border-line bg-white p-4 text-sm tracking-[0.35px]" data-testid="payment-details">
      <p className="font-medium text-ink">Pay with {detail.label}</p>
      {detail.lines.length === 0 ? (
        <p className="text-body">Message us for the {detail.label} details.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {detail.lines.map((line) => (
            <div className="contents" key={line.label}>
              <dt className="text-muted">{line.label}</dt>
              <dd className="text-ink">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
