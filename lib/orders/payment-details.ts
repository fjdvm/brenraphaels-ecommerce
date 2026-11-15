import type { PaymentMethod } from "./orders";

/** Where a Customer sends money for one prepaid method. */
export type PaymentDetail = { method: Exclude<PaymentMethod, "cash-on-delivery">; label: string; lines: { label: string; value: string }[] };

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  "bank-transfer": "Bank transfer",
  "cash-on-delivery": "Cash on Delivery",
};

const read = (name: string) => process.env[name]?.trim() || "";

/**
 * The shop's payment details. The Admin sets them in the Portal's General settings; until the Portal serves them
 * to the storefront they are read from the environment, and a method with no details shows a "ask us" line.
 */
export function paymentDetails(): PaymentDetail[] {
  const list = (method: PaymentDetail["method"], entries: [string, string][]): PaymentDetail => ({
    method, label: PAYMENT_LABELS[method], lines: entries.filter(([, value]) => value).map(([label, value]) => ({ label, value })),
  });
  return [
    list("gcash", [["GCash number", read("PAYMENT_GCASH_NUMBER")], ["Account name", read("PAYMENT_GCASH_NAME")]]),
    list("maya", [["Maya number", read("PAYMENT_MAYA_NUMBER")], ["Account name", read("PAYMENT_MAYA_NAME")]]),
    list("bank-transfer", [["Bank", read("PAYMENT_BANK_NAME")], ["Account name", read("PAYMENT_BANK_ACCOUNT_NAME")], ["Account number", read("PAYMENT_BANK_ACCOUNT_NUMBER")]]),
  ];
}
