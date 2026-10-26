import { afterEach, beforeEach, expect, test, vi } from "vitest";

const deps = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  submit: vi.fn(), proof: vi.fn(), open: vi.fn(), message: vi.fn(), verify: vi.fn(), request: vi.fn(),
}));
vi.mock("next/server", () => ({ after: deps.after }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/customer/current-visitor", () => ({
  requireCustomer: async () => ({ userId: "c1", email: "customer@example.com" }),
  currentVisitor: async () => ({ state: "customer", customer: { userId: "c1" } }),
}));
vi.mock("@/lib/orders/feedback", async (original) => ({
  ...await original<typeof import("@/lib/orders/feedback")>(), createOrderFeedbackStore: () => ({ submit: deps.submit }),
}));
vi.mock("@/lib/orders/orders", async (original) => ({
  ...await original<typeof import("@/lib/orders/orders")>(), createOrderStore: () => ({ submitPaymentProof: deps.proof }),
}));
vi.mock("@/lib/support/tickets", async (original) => ({
  ...await original<typeof import("@/lib/support/tickets")>(),
  createTicketStore: () => ({ open: deps.open, get: async () => ({ status: "open" }), addMessage: deps.message }),
}));
vi.mock("@/lib/email/ticket-created-email", () => ({ sendTicketCreatedEmail: vi.fn() }));
vi.mock("@/lib/neon-auth/server", () => ({ neonVerificationAuth: { verifyEmail: deps.verify } }));
vi.mock("@/lib/customer/verification-token-store", () => ({ createVerificationTokenStore: () => ({ claimVerifiedToken: async () => true }) }));
vi.mock("@/lib/returns/customer-returns", () => ({ createCustomerReturns: () => ({ request: deps.request }) }));
vi.mock("@/lib/returns/return-notices", () => ({ notifyReturnChange: vi.fn() }));

import { submitOrderFeedback, submitPaymentProof } from "@/app/(site)/(protected)/profile/orders/actions";
import { createTicket, sendMessage } from "@/app/(site)/(protected)/support/actions";
import { confirmVerificationEmail } from "@/app/(site)/verify-email/actions";
import { POST as requestReturn } from "@/app/api/orders/[id]/returns/route";

const fetcher = vi.fn<typeof fetch>();
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const feedback = (rating: string) => submitOrderFeedback({}, form({ orderId: "12", rating, comment: "Please improve this." }));
const events = [
  { expected: "verified", kind: "Customer", run: () => confirmVerificationEmail("token"), fail: deps.verify },
  { expected: { message: "Payment proof submitted. We'll email you once it's verified." }, kind: "Payment", run: () => submitPaymentProof(12, {}, form({ gcashReferenceNumber: "1234567890123" })), fail: deps.proof },
  { expected: { created: true, ticketId: 12 }, kind: "Ticket", run: () => createTicket({}, form({ subject: "Missing Delivery", category: "Delivery Issue", body: "Please check my Delivery." })), fail: deps.open },
  { expected: { sent: true, messageId: 2 }, kind: "Ticket", run: () => sendMessage(12, {}, form({ body: "Any update on my Delivery?" })), fail: deps.message },
  { expected: { submitted: true }, kind: "Feedback", run: () => feedback("3"), fail: deps.submit },
  { expected: { id: 1, number: "RMA-1", status: "requested" }, kind: "Return", run: () => requestReturn(new Request("https://store.test/api/orders/12/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), { params: Promise.resolve({ id: "12" }) }), fail: deps.request },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  deps.verify.mockResolvedValue("verified"); deps.proof.mockResolvedValue(undefined);
  deps.submit.mockResolvedValue({ rating: 3 }); deps.open.mockResolvedValue({ id: 12, messages: [] });
  deps.message.mockResolvedValue({ messageId: 2 }); deps.request.mockResolvedValue({ id: 1, number: "RMA-1", status: "requested" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test.each(events)("$kind action sends exactly one kind-only signal after responding", async ({ run, kind }) => {
  await run();
  expect(fetcher).not.toHaveBeenCalled();
  expect(deps.after).toHaveBeenCalledTimes(1);
  await deps.after.mock.calls[0][0]();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("https://gateway.test/creoms/notifications/signal", expect.objectContaining({
    method: "POST", headers: { Authorization: "Bearer storefront-key", "Content-Type": "application/json" }, body: JSON.stringify({ kind }),
  }));
});

test.each(events)("$kind action survives gateway, CREOMS, network and configuration outages", async ({ run, expected }) => {
  for (const outage of ["gateway", "CREOMS", "network", "configuration"]) {
    deps.after.mockClear();
    vi.stubEnv("API_GATEWAY_CALLER_KEY", outage === "configuration" ? "" : "storefront-key");
    if (outage === "network") fetcher.mockRejectedValue(new Error("offline"));
    else fetcher.mockResolvedValue(new Response(null, { status: outage === "gateway" ? 502 : 503 }));
    const result = await run();
    if (result instanceof Response) {
      expect(result.status).toBe(201);
      expect(await result.json()).toEqual(expected);
    } else expect(result).toEqual(expected);
    expect(deps.after).toHaveBeenCalledTimes(1);
    await expect(deps.after.mock.calls[0][0]()).resolves.toBeUndefined();
  }
});

test.each(events)("failed $kind action sends no signal", async ({ run, fail }) => {
  fail.mockRejectedValueOnce(new Error("write failed"));
  try { await run(); } catch { /* Verification propagates the original auth failure. */ }
  expect(deps.after).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

test.each(["1", "2", "3", "4", "5"])("only Feedback rated 1 to 3 signals Staff: %s", async (rating) => {
  expect(await feedback(rating)).toEqual({ submitted: true });
  expect(deps.after).toHaveBeenCalledTimes(Number(Number(rating) <= 3));
});
test.each(["expired", "invalid"])("%s verification sends no signal", async (result) => {
  deps.verify.mockResolvedValue(result);
  expect(await confirmVerificationEmail("token")).toBe(result);
  expect(deps.after).not.toHaveBeenCalled();
});

test.each(events)("$kind action survives a scheduling failure", async ({ run }) => {
  deps.after.mockImplementationOnce(() => { throw new Error("scheduler unavailable"); });
  await expect(run()).resolves.toBeDefined();
  expect(fetcher).not.toHaveBeenCalled();
});
