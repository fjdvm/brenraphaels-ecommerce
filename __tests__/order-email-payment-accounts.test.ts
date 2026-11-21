import { describe, expect, test, vi } from "vitest";

import { emailPaymentOffer, fetchQrImage, renderPaymentInstructions } from "@/lib/email/payment-instructions";
import type { PaymentAccountOption } from "@/lib/orders/payment-offer";

const gcash: PaymentAccountOption = { id: "a1", method: "gcash", label: "Main GCash", accountName: "Bren Raphael's", accountNumber: "09171234567", bankName: null, qrUrl: "https://files.test/qr-a1.png" };
const bank: PaymentAccountOption = { id: "b1", method: "bank-transfer", label: "BPI Savings", accountName: "Bren Raphael's Foods", accountNumber: "1234-5678-90", bankName: "BPI", qrUrl: null };
const png = { content: Buffer.from("png-bytes"), contentType: "image/png", ext: "png" };

describe("Pay your Order: the shop's Payment accounts", () => {
  test("offers the Order's own method, with the account number and the QR attached inline", async () => {
    const fetchQr = vi.fn(async () => png);
    const { offer, attachments } = await emailPaymentOffer("gcash", [gcash, bank], fetchQr);
    expect(fetchQr).toHaveBeenCalledWith("https://files.test/qr-a1.png");
    expect(attachments).toEqual([{ filename: "qr-a1.png", content: png.content, cid: "payment-qr-a1", contentType: "image/png" }]);

    const { html, text } = renderPaymentInstructions(9, "gcash", 55500, offer);
    for (const body of [html, text.join("\n")]) {
      expect(body).toContain("How to pay");
      expect(body).toContain("Main GCash · GCash");
      expect(body).toContain("09171234567");
      expect(body).toContain("Send exactly ₱555");
      expect(body).toContain("Order #9");
      expect(body).toContain("reference number");
      expect(body).not.toContain("BPI");
    }
    expect(html).toContain('src="cid:payment-qr-a1"');
    expect(html).not.toContain("files.test");
  });

  test("shows a bank account's bank name and number, without a QR when it has none", async () => {
    const { offer, attachments } = await emailPaymentOffer("bank-transfer", [gcash, bank], vi.fn());
    expect(attachments).toEqual([]);
    const { html, text } = renderPaymentInstructions(9, "bank-transfer", 55500, offer);
    for (const body of [html, text.join("\n")]) {
      expect(body).toContain("BPI Savings · Bank transfer");
      expect(body).toContain("Bank");
      expect(body).toContain("1234-5678-90");
    }
    expect(html).not.toContain("cid:payment-qr");
  });

  test("a QR that cannot be fetched still shows the account", async () => {
    const { offer, attachments } = await emailPaymentOffer("gcash", [gcash], async () => null);
    expect(attachments).toEqual([]);
    const { html } = renderPaymentInstructions(9, "gcash", 55500, offer);
    expect(html).toContain("09171234567");
    expect(html).not.toContain("<img");
  });

  test("offers another enabled method when the Order's own has no active account", async () => {
    const { offer } = await emailPaymentOffer("maya", [bank], vi.fn());
    const { text } = renderPaymentInstructions(9, "maya", 55500, offer);
    expect(text.join("\n")).toContain("Maya is no longer available");
    expect(text.join("\n")).toContain("1234-5678-90");
  });

  test("with no active account, shows the contact-the-shop notice, never Cash on Delivery", async () => {
    const { offer } = await emailPaymentOffer("gcash", [], vi.fn());
    const { html, text } = renderPaymentInstructions(9, "gcash", 55500, offer);
    for (const body of [html, text.join("\n")]) {
      expect(body).toMatch(/Online payment isn(&#39;|')t available right now/);
      expect(body).not.toContain("Cash on Delivery");
    }
  });

  test("escapes account details", async () => {
    const { offer } = await emailPaymentOffer("gcash", [{ ...gcash, label: "<b>x</b>", qrUrl: null }], vi.fn());
    expect(renderPaymentInstructions(9, "gcash", 100, offer).html).not.toContain("<b>x</b>");
  });
});

describe("fetchQrImage", () => {
  const respond = (body: BodyInit, type: string, status = 200) => vi.fn(async () => new Response(body, { status, headers: { "content-type": type } })) as unknown as typeof fetch;

  test("keeps a PNG or JPEG", async () => {
    expect(await fetchQrImage("https://files.test/q.png", respond("abc", "image/png"))).toMatchObject({ contentType: "image/png", ext: "png" });
    expect(await fetchQrImage("https://files.test/q.jpg", respond("abc", "image/jpeg"))).toMatchObject({ ext: "jpg" });
  });

  test("refuses other types, failures, empty files and non-https links", async () => {
    expect(await fetchQrImage("https://files.test/q", respond("<svg/>", "image/svg+xml"))).toBeNull();
    expect(await fetchQrImage("https://files.test/q", respond("x", "image/png", 404))).toBeNull();
    expect(await fetchQrImage("https://files.test/q", respond("", "image/png"))).toBeNull();
    expect(await fetchQrImage("http://files.test/q.png", respond("abc", "image/png"))).toBeNull();
    expect(await fetchQrImage("https://files.test/q", vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBeNull();
  });

  test("refuses a QR over 5 MB", async () => {
    expect(await fetchQrImage("https://files.test/q", respond(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"))).toBeNull();
  });
});
