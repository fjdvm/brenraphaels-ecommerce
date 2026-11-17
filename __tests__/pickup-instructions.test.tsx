// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
const getDatabase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.test",
}));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

vi.mock("@/components/features/orders/payment-proof-form", () => ({ PaymentProofForm: () => null }));
vi.mock("@/components/features/orders/payment-details-card", () => ({ PaymentDetailsCard: () => null }));

import { OrderPlacedView } from "@/components/features/orders/order-placed";
import { sendOrderPlacedEmail } from "@/lib/email/order-placed-email";
import { loadPickupInstructions, ORIGINAL_ID_REMINDER, pickupReminder } from "@/lib/pickup/instructions";

const row = { country: "Philippines", region: "NCR", province: "", city: "Makati", barangay: "Poblacion", street: "12 Main St", hours: "Mon-Sat 9am-5pm", note: "Ring the bell." };
const reader = (rows: unknown[]) => ({ execute: async () => rows });
const base = { id: 7, fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", status: "placed", subtotalInCentavos: 10000, deliveryFeeInCentavos: null, lines: [], approvedDiscountInCentavos: 0, seniorPwd: null } as never;
const withDiscount = { ...(base as object), approvedDiscountInCentavos: 500 } as never;

beforeEach(() => { sendMail.mockReset(); getDatabase.mockReset(); });

describe("loadPickupInstructions", () => {
  test("joins the saved address and keeps hours and note", async () => {
    expect(await loadPickupInstructions(reader([row]))).toEqual({ address: "12 Main St, Poblacion, Makati, NCR", hours: "Mon-Sat 9am-5pm", note: "Ring the bell." });
  });
  test("is null when nothing is saved or the read fails", async () => {
    expect(await loadPickupInstructions(reader([{ ...row, street: "" }]))).toBeNull();
    expect(await loadPickupInstructions({ execute: async () => { throw new Error("down"); } })).toBeNull();
  });
});

describe("original ID reminder", () => {
  test("appears only when a discount applies", () => {
    expect(pickupReminder(base)).toBeNull();
    expect(pickupReminder(withDiscount)).toBe(ORIGINAL_ID_REMINDER);
    expect(pickupReminder({ ...(base as object), seniorPwd: { discountInCentavos: 300 } } as never)).toBe(ORIGINAL_ID_REMINDER);
  });
});

describe("Pickup email", () => {
  test("shows the saved instructions, no reminder without a discount", async () => {
    getDatabase.mockReturnValue(reader([row]));
    await sendOrderPlacedEmail("a@b.com", base);
    const { text } = sendMail.mock.calls[0][0];
    expect(text).toContain("Pickup address: 12 Main St, Poblacion, Makati, NCR");
    expect(text).toContain("Pickup hours: Mon-Sat 9am-5pm");
    expect(text).toContain("Ring the bell.");
    expect(text).not.toContain("original");
  });
  test("adds the reminder when a discount applies", async () => {
    getDatabase.mockReturnValue(reader([row]));
    await sendOrderPlacedEmail("a@b.com", withDiscount);
    expect(sendMail.mock.calls[0][0].text).toContain(ORIGINAL_ID_REMINDER);
  });
  test("a changed setting changes the next email", async () => {
    getDatabase.mockReturnValueOnce(reader([row])).mockReturnValueOnce(reader([{ ...row, hours: "Daily 10am-4pm" }]));
    await sendOrderPlacedEmail("a@b.com", base);
    await sendOrderPlacedEmail("a@b.com", base);
    expect(sendMail.mock.calls[1][0].text).toContain("Daily 10am-4pm");
  });
  test("still sends when the setting cannot be read; Delivery emails have none", async () => {
    getDatabase.mockImplementation(() => { throw new Error("no db"); });
    await sendOrderPlacedEmail("a@b.com", base);
    expect(sendMail.mock.calls[0][0].text).not.toContain("Pickup address");
    await sendOrderPlacedEmail("a@b.com", { ...(base as object), fulfillmentMethod: "delivery" } as never);
    expect(sendMail.mock.calls[1][0].text).not.toContain("Pickup address");
  });
});

describe("Order page", () => {
  const pickup = { address: "12 Main St", hours: "Mon-Sat 9am-5pm", note: "Ring the bell." };
  test("shows the instructions without the reminder", () => {
    render(<OrderPlacedView order={base} details={[]} pickup={pickup} />);
    expect(screen.getByText("12 Main St")).toBeTruthy();
    expect(screen.queryByText(ORIGINAL_ID_REMINDER)).toBeNull();
  });
  test("shows the reminder when a discount applies", () => {
    render(<OrderPlacedView order={withDiscount} details={[]} pickup={pickup} />);
    expect(screen.getByText(ORIGINAL_ID_REMINDER)).toBeTruthy();
  });
});
