import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orderEmailOutcomes, orderLines, orderReturnItems, orderReturns, orders } from "../lib/db/schema";
import { renderReturnRefundedEmail, sendReturnRefundedEmail, loadRefundedReturn } from "../lib/email/return-refunded-email";
import { resendOrderEmail } from "../lib/email/retry";
import { notifyReturnChange } from "../lib/returns/return-notices";
import { createTestDatabase } from "./helpers/test-database";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: { address: "shop@brenraphaels.test" } }),
  requiredEnvironment: () => "https://shop.example.test",
}));
vi.mock("../lib/email/layout", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/email/layout")>()), logoAttachment: async () => ({ filename: "logo.jpeg", content: Buffer.from(""), cid: "x" }) }));

const refund = { orderId: 8, returnId: 5, items: [{ productName: "Ube Jam", sizeLabel: "250 g", quantity: 2, priceInCentavos: 10_000 }],
  deliveryFeeInCentavos: 5_000, amountInCentavos: 25_000, paidOn: "2026-11-18", method: "gcash", reference: "GC-2026-0001" };
const url = "https://shop.example.test/profile/orders?order=8";

describe("rendering", () => {
  test("carries the order number, items, Delivery fee, amount, date, method, reference and the proof", () => {
    const { subject, html, text } = renderReturnRefundedEmail(refund, url, true);
    expect(subject).toBe("Return RMA-5 refunded");
    for (const part of ["Order #8", "Ube Jam · 250 g × 2", "₱200", "Delivery fee", "₱50", "₱250", "Nov 18, 2026", "GCash", "GC-2026-0001", "cid:refund-proof"]) expect(html).toContain(part);
    expect(text).toContain("Reference: GC-2026-0001");
    expect(text).toContain("Method: GCash");
    expect(text).toContain("The proof of refund is attached.");
  });

  test("leaves out the Delivery fee line when none was refunded", () => {
    const { html, text } = renderReturnRefundedEmail({ ...refund, deliveryFeeInCentavos: 0, amountInCentavos: 20_000 }, url, false);
    expect(html).not.toContain("Delivery fee");
    expect(html).not.toContain("cid:refund-proof");
    expect(text).not.toContain("attached");
  });
});

describe("sending", () => {
  beforeEach(() => { sendMail.mockReset(); sendMail.mockResolvedValue({ messageId: "<m1>" }); });

  test("attaches the proof inline and uses the stable id as its Message-ID", async () => {
    const readProof = vi.fn().mockResolvedValue({ content: Buffer.from("png"), contentType: "image/png" });
    const result = await sendReturnRefundedEmail("maria@example.com", { ...refund, proofFileId: "file-1" }, { id: "order-8-return-refunded-5" }, readProof);
    expect(readProof).toHaveBeenCalledWith("file-1");
    expect(result).toEqual({ messageId: "<m1>" });
    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: "maria@example.com", messageId: "<order-8-return-refunded-5@brenraphaels.test>" });
    expect(mail.attachments).toEqual(expect.arrayContaining([expect.objectContaining({ cid: "refund-proof", contentType: "image/png" })]));
  });

  test("fails, so it is retried, when the proof cannot be read", async () => {
    await expect(sendReturnRefundedEmail("maria@example.com", { ...refund, proofFileId: "file-1" }, undefined, vi.fn().mockRejectedValue(new Error("down")))).rejects.toThrow("down");
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("when a Return is Refunded", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let orderId: number;
  let returnId: number;

  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
    sendMail.mockReset(); sendMail.mockResolvedValue({ messageId: "<m1>" });
    client = await createTestDatabase();
    db = drizzle(client);
    await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "S", fullName: "Maria S", email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
    [{ id: orderId }] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery", paymentMethod: "gcash", subtotalInCentavos: 20_000 }).returning();
    [{ id: returnId }] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 20_000, status: "refunded", finalResolution: "refund",
      refundedAt: new Date(), refundProofFileId: "file-1", refundAmountInCentavos: 25_000, refundDeliveryFeeInCentavos: 5_000, refundPaidMethod: "gcash", refundPaidOn: "2026-11-18", refundReference: "GC-2026-0001" }).returning();
    const [line] = await db.insert(orderLines).values({ orderId, productId: 1, productName: "Ube Jam", sizeLabel: "250 g", quantity: 2, priceInCentavos: 10_000 } as never).returning();
    await db.insert(orderReturnItems).values({ returnId, orderLineId: line.id, productName: "Ube Jam", sizeLabel: "250 g", quantity: 2, priceInCentavos: 10_000 } as never);
  });
  afterEach(async () => { await client.close(); vi.unstubAllEnvs(); });

  test("sends the refund email once under its stable id, however often the notice runs", async () => {
    const sent: string[] = [];
    const senders = { email: async () => { throw new Error("generic email must not be used"); }, notification: async () => {},
      refundEmail: async (database: never, record: never, to: string) => { sent.push(to); return (await import("../lib/email/outcomes")).sendOnceAndRecord(orderId, "return-refunded", async () => ({}), database, String((record as { id: number }).id)); } };
    const [record] = await db.select().from(orderReturns).where(eq(orderReturns.id, returnId));
    await notifyReturnChange(db, record, senders as never);
    await notifyReturnChange(db, record, senders as never);
    expect(sent).toEqual(["maria@example.com", "maria@example.com"]);
    const rows = await db.select().from(orderEmailOutcomes).where(eq(orderEmailOutcomes.orderId, orderId));
    expect(rows).toMatchObject([{ kind: "return-refunded", occurrence: String(returnId), status: "sent" }]);
  });

  test("loads what the email says from the saved Return", async () => {
    expect(await loadRefundedReturn(db, returnId)).toMatchObject({ orderId, amountInCentavos: 25_000, deliveryFeeInCentavos: 5_000, reference: "GC-2026-0001", proofFileId: "file-1" });
    await db.update(orderReturns).set({ status: "approved" }).where(eq(orderReturns.id, returnId));
    expect(await loadRefundedReturn(db, returnId)).toBeNull();
  });

  test("a Resend of the same Return keeps the same stable id", async () => {
    vi.doMock("../lib/email/return-refunded-email", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/email/return-refunded-email")>()), fetchRefundProof: async () => ({ content: Buffer.from("x"), contentType: "image/jpeg" }) }));
    await expect(resendOrderEmail(orderId + 99, "return-refunded", db as never, { id: "order-1-return-refunded-1" }, String(returnId))).rejects.toThrow(/not found/);
  });
});
