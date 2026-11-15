import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({ createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }) }));

import { sendOrderDispatchedEmail } from "@/lib/email/order-dispatched-email";

const base = { id: 4 } as never;
describe("dispatched email", () => {
  test("carries the link and rider details", async () => {
    await sendOrderDispatchedEmail("a@b.com", { ...(base as object), courier: { name: "Grab", trackingUrl: "https://g.co/1", riderName: "Jo", riderPlate: "AB 1", riderPhone: null } } as never);
    const { text, subject } = sendMail.mock.calls[0][0];
    expect(subject).toBe("Order #4 is on its way");
    expect(text).toContain("Track your delivery: https://g.co/1");
    expect(text).toContain("Rider: Jo");
    expect(text).not.toContain("Rider contact");
  });
  test("sends nothing without a courier", async () => {
    sendMail.mockReset();
    await sendOrderDispatchedEmail("a@b.com", { id: 1, courier: null } as never);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
