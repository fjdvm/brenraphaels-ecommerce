import { beforeEach, describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.test",
}));
const getDatabase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ getDatabase }));

import { renderPickupConfirmedEmail, sendOrderPickupConfirmedEmail, totalPayableAtPickup } from "@/lib/email/order-pickup-confirmed-email";
import { sendOnceAndRecord } from "@/lib/email/outcomes";
import { EMAIL_TOKENS } from "@/lib/email/layout";

const instructions = { address: "12 Main St, Makati", hours: "Mon-Sat 9am-5pm", note: "Ring the bell." };
const order = {
  id: 7, fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", status: "confirmed",
  subtotalInCentavos: 50000, deliveryFeeInCentavos: null, approvedDiscountInCentavos: 2500, totalInCentavos: 47500,
  lines: [{ productName: "Ube Halaya", sizeLabel: "250g", priceInCentavos: 25000, quantity: 2 }],
} as never;
const noDiscount = { ...(order as object), approvedDiscountInCentavos: 0, totalInCentavos: 50000 } as never;
const url = "https://shop.test/profile/orders?order=7";

describe("COD + Pickup confirmation email", () => {
  test("shows items, discount, total payable upon pickup, instructions and View Order", () => {
    const { html, text, subject } = renderPickupConfirmedEmail(order, instructions, url);
    expect(subject).toBe("Order #7 confirmed");
    for (const body of [html, text]) {
      expect(body).toContain("Ube Halaya — 250g × 2");
      expect(body).toContain("₱500");
      expect(body).toContain("Senior/PWD discount");
      expect(body).toContain("₱25");
      expect(body).toContain("Total payable upon pickup");
      expect(body).toContain("₱475");
      expect(body).toContain("12 Main St, Makati");
      expect(body).toContain("Mon-Sat 9am-5pm");
      expect(body).toContain("original Senior Citizen or PWD ID");
      expect(body).toContain(url);
    }
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain(">View Order<");
  });

  test("uses the Figma foundation colors and fonts", () => {
    const { html } = renderPickupConfirmedEmail(order, instructions, url);
    expect(html).toContain(EMAIL_TOKENS.primary);
    expect(html).toContain("#4A2373");
    expect(html).toContain("Libre Baskerville");
    expect(html).toContain("DM Sans");
    expect(html).toContain('src="cid:bren-raphaels-logo"');
  });

  test("leaves out the discount line and ID reminder without a discount, and escapes the note", () => {
    const { html, text } = renderPickupConfirmedEmail(noDiscount, { ...instructions, note: "<b>Hi</b>" }, url);
    expect(html).not.toContain("Senior/PWD discount");
    expect(text).not.toContain("original");
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(html).not.toContain("<b>Hi</b>");
  });

  test("still sends when no pickup instructions are saved", () => {
    const { html } = renderPickupConfirmedEmail(noDiscount, null, url);
    expect(html).toContain("Total payable upon pickup");
    expect(html).not.toContain("Pickup instructions");
  });

  test("total falls back to subtotal less discount before one is saved", () => {
    expect(totalPayableAtPickup({ ...(order as object), totalInCentavos: null } as never)).toBe(47500);
  });

  test("sends HTML, text and the logo, linking the Customer's own Order", async () => {
    sendMail.mockReset();
    getDatabase.mockReturnValue({ execute: async () => [{ country: "PH", region: "", province: "", city: "Makati", barangay: "", street: "12 Main St", hours: "9-5", note: "" }] });
    await sendOrderPickupConfirmedEmail("a@b.com", order);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe("a@b.com");
    expect(sent.html).toContain(url);
    expect(sent.attachments[0].cid).toBe("bren-raphaels-logo");
  });
});

function fakeDb(existing: boolean) {
  const updates: unknown[] = [];
  const db = {
    insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => (existing ? [] : [{ orderId: 7 }]) }) }) }),
    update: () => ({ set: (v: unknown) => ({ where: async () => { updates.push(v); } }) }),
  };
  return { db: db as never, updates };
}

describe("email outcome record", () => {
  beforeEach(() => vi.clearAllMocks());

  test("records sent", async () => {
    const { db, updates } = fakeDb(false);
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await sendOnceAndRecord(7, "pickup-confirmed", send, db)).toBe("sent");
    expect(updates[0]).toMatchObject({ status: "sent", reason: null });
  });

  test("a failed first send is kept for retry with the reason and does not throw", async () => {
    const { db, updates } = fakeDb(false);
    expect(await sendOnceAndRecord(7, "pickup-confirmed", async () => { throw new Error("SMTP down"); }, db)).toBe("retrying");
    expect(updates[0]).toMatchObject({ status: "retrying", reason: "SMTP down" });
  });

  test("a second confirmation sends nothing", async () => {
    const { db } = fakeDb(true);
    const send = vi.fn();
    expect(await sendOnceAndRecord(7, "pickup-confirmed", send, db)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });
});
