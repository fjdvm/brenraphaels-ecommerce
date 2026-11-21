import { CopyNumber } from "@/components/features/orders/copy-number";
import { ZoomableQr } from "@/components/features/orders/zoomable-qr";
import { formatPeso } from "@/lib/catalog/currency";
import { paymentOffer, type PaymentAccountOption } from "@/lib/orders/payment-offer";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";
import type { PaymentMethod } from "@/lib/orders/orders";
import { email, phones } from "@/lib/site/store-info";

/** The final amount, the deadline and the shop's active accounts with their numbers and QR codes, for an Order awaiting payment. */
export function PaymentAccountsCard({ method, accounts, amountInCentavos, deadline }: { method: PaymentMethod; accounts: PaymentAccountOption[]; amountInCentavos: number; deadline: string }) {
  const offer = paymentOffer(method, accounts);

  if (offer.kind === "none") {
    return (
      <div className="flex flex-col gap-2 border border-line bg-surface-soft p-4 text-sm tracking-[0.35px] text-body" data-testid="no-online-method">
        <p className="font-medium text-ink">Online payment isn&apos;t available right now</p>
        <p>Please contact the shop and we&apos;ll help you complete your payment. Your deadline and total stay the same.</p>
        <p className="text-ink">{email}{phones[0] ? ` · ${phones[0].number}` : ""}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-line bg-white p-4 text-sm tracking-[0.35px]" data-testid="payment-accounts">
      <p className="font-medium text-ink">Send {formatPeso(amountInCentavos)} by {deadline}</p>
      {offer.switched ? (
        <p className="text-body" data-testid="method-switched">{PAYMENT_LABELS[method]} is no longer available. Pay with one of these instead; your deadline and total stay the same.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {offer.accounts.map((account) => (
          <li className="flex flex-col gap-4 border-t border-line pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between" data-testid="payment-account" key={account.id}>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium text-ink">{account.label} · {PAYMENT_LABELS[account.method]}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {account.bankName ? <div className="contents"><dt className="text-muted">Bank</dt><dd className="text-ink">{account.bankName}</dd></div> : null}
                <div className="contents"><dt className="text-muted">Account name</dt><dd className="text-ink">{account.accountName}</dd></div>
                <div className="contents"><dt className="text-muted">Account number</dt><dd><CopyNumber value={account.accountNumber} /></dd></div>
              </dl>
            </div>
            {account.qrUrl ? <ZoomableQr label={account.label} src={account.qrUrl} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
