import { describe, expect, test } from "vitest";
import { checkReceipt, readReceiptText } from "@/lib/orders/screenshot-reading";

const gcash = `Express Send
Sent via GCash
Amount        P209.00
Total Amount Sent  ₱209.00
Ref No. 5012 334 812
Oct 16, 2026 2:30 PM`;

describe("recognised text to fields", () => {
  test("reads reference, amount and date from a GCash receipt", () => {
    expect(readReceiptText(gcash)).toEqual({ reference: "5012334812", amountInCentavos: 20900, paidAt: "2026-10-16T14:30" });
  });
  test("handles thousands separators, 12 AM and ISO dates", () => {
    expect(readReceiptText("Amount 1,234.50\nReference Number: 9876543210123\n2026-01-02 09:05").amountInCentavos).toBe(123450);
    expect(readReceiptText("Jan 5, 2026 12:10 AM").paidAt).toBe("2026-01-05T00:10");
  });
  test("leaves out what it cannot read, and reads nothing from noise", () => {
    expect(readReceiptText("blurry ~~ ###")).toEqual({});
    expect(readReceiptText("Ref No. 12").reference).toBeUndefined();
    expect(readReceiptText("Feb 30, 2026 1:00 PM").paidAt).toBeUndefined();
  });
});

describe("checks", () => {
  const order = { totalInCentavos: 20900, placedAt: new Date("2026-10-16T06:00:00Z") }; // 2:00 PM PHT
  test("passes a matching amount and a date after placing", () => {
    expect(checkReceipt({ amountInCentavos: 20900, paidAt: "2026-10-16T14:30" }, order)).toEqual({
      amount: { passed: true, note: "Matches your order total" },
      date: { passed: true, note: "After you placed the order" },
    });
  });
  test("fails a wrong amount and a date before placing", () => {
    const checks = checkReceipt({ amountInCentavos: 10000, paidAt: "2026-10-16T13:00" }, order);
    expect(checks.amount?.passed).toBe(false);
    expect(checks.date?.passed).toBe(false);
  });
  test("draws no check for a value that is missing", () => {
    expect(checkReceipt({}, order)).toEqual({});
  });
});
