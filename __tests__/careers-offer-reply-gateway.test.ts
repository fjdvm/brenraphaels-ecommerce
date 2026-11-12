import { describe, expect, test, vi } from "vitest";

import { OfferReplyRefusal, createHrmsOfferReplyGateway, replyToOffer } from "@/lib/careers/offer-reply";

const env = { HRMS_URL: "https://hrms.example.test/", CAREERS_CALLER_KEY: "caller-key" };
const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("HRMS offer-reply gateway", () => {
  test("posts the answer for the Applicant to HRMS's Careers endpoint with the caller key", async () => {
    const fetch = answer(200, { ok: true });
    await createHrmsOfferReplyGateway({ env, fetch }).reply({ offerId: 42, applicantId: "applicant-1", answer: "Accepted" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hrms.example.test/api/careers/offers/42/reply");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer caller-key");
    expect(JSON.parse(init.body as string)).toEqual({ applicantId: "applicant-1", answer: "Accepted" });
  });

  test("a refusal carries HRMS's message", async () => {
    const message = "This offer has already been answered. A reply is final.";
    for (const status of [400, 404, 409]) {
      await expect(createHrmsOfferReplyGateway({ env, fetch: answer(status, { error: "x", message }) }).reply({ offerId: 1, applicantId: "a", answer: "Declined" }))
        .rejects.toMatchObject({ name: "OfferReplyRefusal", message, status });
    }
  });

  test("an auth failure, a server error or an unreadable body is a plain failure, not a refusal", async () => {
    for (const fetch of [answer(401, { error: "unauthorized" }), answer(503, { message: "Something went wrong." }), vi.fn(async () => new Response("<html>", { status: 409 }))]) {
      const failure = createHrmsOfferReplyGateway({ env, fetch }).reply({ offerId: 1, applicantId: "a", answer: "Accepted" });
      await expect(failure).rejects.toThrow();
      await expect(failure).rejects.not.toBeInstanceOf(OfferReplyRefusal);
    }
  });

  test("without HRMS_URL and the caller key it sends nothing", async () => {
    const fetch = answer(200);
    for (const missing of [{}, { HRMS_URL: "https://hrms.example.test" }, { CAREERS_CALLER_KEY: "k" }]) {
      await expect(createHrmsOfferReplyGateway({ env: missing, fetch }).reply({ offerId: 1, applicantId: "a", answer: "Accepted" })).rejects.toThrow("not configured");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("replyToOffer", () => {
  const target = { applicantId: "applicant-1", offerId: 42 };

  test("flag off: nothing is sent", async () => {
    const reply = vi.fn();
    await expect(replyToOffer({ kind: "accept", ...target }, { enabled: false, gateway: { reply } })).resolves.toEqual({ ok: false, message: "Coming soon. We'll email you the details." });
    expect(reply).not.toHaveBeenCalled();
  });

  test("maps accept and decline to the HRMS answers", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await replyToOffer({ kind: "accept", ...target }, { enabled: true, gateway: { reply } });
    await replyToOffer({ kind: "decline", ...target }, { enabled: true, gateway: { reply } });
    expect(reply.mock.calls.map(([input]) => input.answer)).toEqual(["Accepted", "Declined"]);
  });

  test("shows a refusal's message, and a retry message for any other failure, without logging secrets", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(replyToOffer({ kind: "accept", ...target }, { enabled: true, gateway: { reply: vi.fn().mockRejectedValue(new OfferReplyRefusal("No such offer for this applicant.", 404)) } }))
      .resolves.toEqual({ ok: false, message: "No such offer for this applicant." });
    await expect(replyToOffer({ kind: "decline", ...target }, { enabled: true, gateway: { reply: vi.fn().mockRejectedValue(new Error("HRMS answered 503")) } }))
      .resolves.toEqual({ ok: false, message: "We couldn't decline your offer. Try again." });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/caller-key|Bearer/);
    log.mockRestore();
  });
});
