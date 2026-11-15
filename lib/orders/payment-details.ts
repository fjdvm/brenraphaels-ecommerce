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

type Settings = Record<"gcashNumber" | "gcashName" | "mayaNumber" | "mayaName" | "bankName" | "bankAccountName" | "bankAccountNumber", string>;

const fromEnvironment = (): Settings => ({
  gcashNumber: read("PAYMENT_GCASH_NUMBER"), gcashName: read("PAYMENT_GCASH_NAME"),
  mayaNumber: read("PAYMENT_MAYA_NUMBER"), mayaName: read("PAYMENT_MAYA_NAME"),
  bankName: read("PAYMENT_BANK_NAME"), bankAccountName: read("PAYMENT_BANK_ACCOUNT_NAME"), bankAccountNumber: read("PAYMENT_BANK_ACCOUNT_NUMBER"),
});

/** The Admin's settings from the Portal (System secret); the environment answers when the Portal is not configured or down. */
async function settings(): Promise<Settings> {
  const url = read("PORTAL_URL"), secret = read("PORTAL_ECOMMERCE_SECRET");
  if (!url || !secret) return fromEnvironment();
  try {
    const response = await fetch(new URL("/api/integrations/payment-details", url), {
      headers: { Authorization: `Basic ${Buffer.from(`Ecommerce:${secret}`).toString("base64")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return fromEnvironment();
    const body = (await response.json()) as { settings?: Partial<Settings> };
    const env = fromEnvironment();
    return Object.fromEntries(Object.entries(env).map(([key, fallback]) => [key, body.settings?.[key as keyof Settings]?.trim() || fallback])) as Settings;
  } catch {
    return fromEnvironment();
  }
}

/** The shop's payment details. The Admin sets them in the Portal's General settings; a method with none shows an "ask us" line. */
export async function paymentDetails(): Promise<PaymentDetail[]> {
  const s = await settings();
  const list = (method: PaymentDetail["method"], entries: [string, string][]): PaymentDetail => ({
    method, label: PAYMENT_LABELS[method], lines: entries.filter(([, value]) => value).map(([label, value]) => ({ label, value })),
  });
  return [
    list("gcash", [["GCash number", s.gcashNumber], ["Account name", s.gcashName]]),
    list("maya", [["Maya number", s.mayaNumber], ["Account name", s.mayaName]]),
    list("bank-transfer", [["Bank", s.bankName], ["Account name", s.bankAccountName], ["Account number", s.bankAccountNumber]]),
  ];
}
