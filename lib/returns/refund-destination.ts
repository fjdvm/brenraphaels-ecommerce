import { z } from "zod";

export const refundMethods = ["gcash", "maya", "bank-transfer"] as const;
export type RefundMethod = (typeof refundMethods)[number];
export const refundMethodLabels: Record<RefundMethod, string> = { gcash: "GCash", maya: "Maya", "bank-transfer": "Bank transfer" };

export type RefundDestinationValues = {
  method: RefundMethod | "";
  accountName: string;
  accountNumber: string;
  bankName: string;
};
export type RefundDestinationErrors = Partial<Record<keyof RefundDestinationValues, string>>;

/** A refund destination as stored: the bank name is empty unless the method is a bank transfer. */
export type RefundDestination = { method: RefundMethod; accountName: string; accountNumber: string; bankName: string | null };

const namePattern = /^[\p{L}\p{M}\s'.,-]+$/u;
const digits = (value: string) => value.replace(/[\s-]/g, "");

/** Mirrors on screen exactly what the server enforces. The server remains the authority. */
export function validateRefundDestination(values: RefundDestinationValues): RefundDestinationErrors {
  const errors: RefundDestinationErrors = {};
  if (!values.method) errors.method = "Choose where to send your refund.";
  const name = values.accountName.trim();
  if (!name) errors.accountName = "Enter the account name.";
  else if (name.length > 100 || !namePattern.test(name)) errors.accountName = "Enter the account name using letters only, up to 100 characters.";
  const number = digits(values.accountNumber);
  if (!number) errors.accountNumber = "Enter the account number.";
  else if (!/^\d+$/.test(number)) errors.accountNumber = "The account number can only have digits.";
  else if (values.method === "bank-transfer" ? number.length < 6 || number.length > 20 : !/^09\d{9}$/.test(number)) {
    errors.accountNumber = values.method === "bank-transfer"
      ? "A bank account number has 6 to 20 digits."
      : `A ${values.method ? refundMethodLabels[values.method] : "wallet"} number is 11 digits and starts with 09.`;
  }
  if (values.method === "bank-transfer") {
    const bank = values.bankName.trim();
    if (!bank) errors.bankName = "Enter the bank name.";
    else if (bank.length > 100 || /[<>\u0000-\u001f\u007f]/u.test(bank)) errors.bankName = "Enter a valid bank name, up to 100 characters.";
  }
  return errors;
}

export const refundDestinationInput = z.object({
  method: z.enum(refundMethods, { error: "Choose where to send your refund." }),
  accountName: z.string().max(200),
  accountNumber: z.string().max(60),
  bankName: z.string().max(200).optional(),
  /** The Customer must tick that these details are right before submitting. */
  confirmed: z.literal(true, { error: "Confirm your refund details before sending." }),
}).strict().transform((value, ctx): RefundDestination => {
  const errors = validateRefundDestination({ method: value.method, accountName: value.accountName,
    accountNumber: value.accountNumber, bankName: value.bankName ?? "" });
  const [path, message] = Object.entries(errors)[0] ?? [];
  if (path) ctx.addIssue({ code: "custom", message: message!, path: [path] });
  return { method: value.method, accountName: value.accountName.trim().replace(/\s+/g, " "),
    accountNumber: digits(value.accountNumber),
    bankName: value.method === "bank-transfer" ? (value.bankName ?? "").trim().replace(/\s+/g, " ") : null };
});

/** The Customer sees their own number in full; everyone else is shown it masked to the last four digits. */
export const maskAccountNumber = (number: string) => `${"•".repeat(Math.max(number.length - 4, 0))}${number.slice(-4)}`;
