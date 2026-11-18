import type { PaymentMethod } from "./payment-methods";

/** Safe to import from client components. One active Payment account the shop receives money in. */
export type PaymentAccountOption = {
  id: string;
  method: Exclude<PaymentMethod, "cash-on-delivery">;
  label: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  /** A short-lived signed link to the account's QR; null when it has none or the link could not be made. A missing QR never hides the account. */
  qrUrl: string | null;
};

export type PaymentOffer =
  | { kind: "accounts"; accounts: PaymentAccountOption[]; /** The Order's own method is off, so these belong to another enabled method. */ switched: boolean }
  | { kind: "none" };

/**
 * What an Order awaiting payment is offered: the active accounts of its own method, else those of another enabled
 * method (the deadline and total never change), else nothing. Never Cash on Delivery.
 */
export function paymentOffer(method: PaymentMethod, accounts: PaymentAccountOption[]): PaymentOffer {
  const own = accounts.filter((account) => account.method === method);
  if (own.length > 0) return { kind: "accounts", accounts: own, switched: false };
  return accounts.length > 0 ? { kind: "accounts", accounts, switched: true } : { kind: "none" };
}
