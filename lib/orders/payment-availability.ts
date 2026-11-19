import { type PaymentAvailability } from "./payment-methods";

/** What checkout offers when CREOMS cannot be asked: only Cash on Delivery, so no Customer pays into an account that may be off. */
export const COD_ONLY: PaymentAvailability = { "cash-on-delivery": true, gcash: false, maya: false, "bank-transfer": false };

/**
 * Which prepaid methods the shop has on, asked of CREOMS at checkout (GET /api/payment-methods). CREOMS says a method is on only when
 * a Manager or the CEO has it enabled and an account is active. If CREOMS is not set up, slow or refuses, the answer is Cash on Delivery
 * only. Nothing here polls: it runs when checkout renders and when an Order is placed.
 */
export async function fetchPaymentAvailability(): Promise<PaymentAvailability> {
  const origin = process.env.CREOMS_URL?.trim();
  const secret = process.env.CREOMS_SERVICE_SECRET;
  if (!origin || !secret) {
    console.error("Payment methods: CREOMS_URL or CREOMS_SERVICE_SECRET is not set, offering Cash on Delivery only.");
    return COD_ONLY;
  }
  try {
    const response = await fetch(new URL("/api/payment-methods", origin), {
      headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.error(`Payment methods: CREOMS answered ${response.status}, offering Cash on Delivery only.`);
      return COD_ONLY;
    }
    const body = (await response.json()) as { methods?: Record<string, unknown> };
    const on = (key: string) => body.methods?.[key] === true;
    return { "cash-on-delivery": true, gcash: on("gcash"), maya: on("maya"), "bank-transfer": on("bank_transfer") };
  } catch (error) {
    console.error("Payment methods: CREOMS could not be reached, offering Cash on Delivery only.", error);
    return COD_ONLY;
  }
}
