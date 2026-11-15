/** Safe to import from client components: no server-only imports. */
export const paymentMethods = ["cash-on-delivery", "gcash", "maya", "bank-transfer"] as const;
/** GCash, Maya and bank transfer are all manual: a reference number and an optional screenshot. */
export const prepaidMethods = ["gcash", "maya", "bank-transfer"] as const;
/** After this many rejected proofs, only a Manager can approve the Order. */
export const MANAGER_AFTER_REJECTIONS = 3;
export type PaymentMethod = (typeof paymentMethods)[number];
export const isPrepaid = (method: string): boolean => (prepaidMethods as readonly string[]).includes(method);
