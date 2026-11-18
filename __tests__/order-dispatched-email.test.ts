import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({ createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }) }));

import { sendOrderDispatchedEmail } from "@/lib/email/order-dispatched-email";

const base = { id: 4 } as never;
describe("dispatched email", () => {
  test("carries the link and never rider details", async () => {
    await sendOrderDispatchedEmail("a@b.com", { ...(base as object), courier: { name: "Grab", trackingUrl: "https://g.co/1", riderName: "Jo", riderPlate: "AB 1", riderPhone: "0917" } } as never);
    const { text, subject } = sendMail.mock.calls[0][0];
    expect(subject).toBe("Order #4 is on its way");
    expect(text).toContain("Track your delivery: https://g.co/1");
    expect(text).not.toMatch(/Rider|Jo\b|AB 1|0917/);
  });
  test("says there is no link yet when Staff gave none, without a broken link line", async () => {
    sendMail.mockReset();
    await sendOrderDispatchedEmail("a@b.com", { id: 4, courier: { name: "Grab", trackingUrl: null } } as never);
    const { text } = sendMail.mock.calls[0][0];
    expect(text).toContain("dispatched with Grab");
    expect(text).toContain("A tracking link is not available yet.");
    expect(text).not.toContain("Track your delivery");
  });
  test("sends nothing without a courier", async () => {
    sendMail.mockReset();
    await sendOrderDispatchedEmail("a@b.com", { id: 1, courier: null } as never);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
