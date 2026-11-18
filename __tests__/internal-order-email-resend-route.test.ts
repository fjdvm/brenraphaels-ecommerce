import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { mintCreomsCredential } from "@/lib/orders/creoms-credential";

const { resendStaffEmail } = vi.hoisted(() => ({ resendStaffEmail: vi.fn() }));
vi.mock("@/lib/email/retry", () => ({ resendStaffEmail }));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => { ({ POST: post } = await import("../app/api/internal/orders/[id]/email/resend/route")); });
beforeEach(() => {
  process.env.CREOMS_SERVICE_SECRET = "k".repeat(40);
  resendStaffEmail.mockReset().mockResolvedValue({ ok: true, status: "sent" });
});

const staff = { staffId: "staff-17", staffName: "Ana Cruz" };
const request = (body: unknown, credential: string | null = mintCreomsCredential()) => new Request("https://shop.example.test/api/internal/orders/12/email/resend", {
  method: "POST", body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
});
const call = (body: unknown, id = "12", credential?: string | null) => post(request(body, credential), { params: Promise.resolve({ id }) });

describe("POST /api/internal/orders/:id/email/resend", () => {
  test("resends one occurrence and echoes the kind and occurrence", async () => {
    const response = await call({ kind: "rejected", occurrence: "2", ...staff });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 12, kind: "rejected", occurrence: "2", status: "sent" });
    expect(resendStaffEmail).toHaveBeenCalledWith(12, "rejected", "2");
  });

  test("answers reconciled, and a missing occurrence is the empty one", async () => {
    resendStaffEmail.mockResolvedValue({ ok: true, status: "reconciled" });
    const body = await (await call({ kind: "paid", ...staff })).json();
    expect(body).toEqual({ id: 12, kind: "paid", occurrence: null, status: "reconciled" });
    expect(resendStaffEmail).toHaveBeenCalledWith(12, "paid", "");
  });

  test("refuses without a valid credential", async () => {
    expect((await call({ kind: "paid", ...staff }, "12", null)).status).toBe(401);
    expect(resendStaffEmail).not.toHaveBeenCalled();
  });

  test("refuses a bad Order id, kind, occurrence or missing staff attribution", async () => {
    expect((await call({ kind: "paid", ...staff }, "0")).status).toBe(400);
    expect((await call({ kind: "Paid; drop", ...staff })).status).toBe(400);
    expect((await call({ kind: "paid", occurrence: "1;2", ...staff })).status).toBe(400);
    expect((await call({ kind: "paid" })).status).toBe(400);
    expect(resendStaffEmail).not.toHaveBeenCalled();
  });

  test("says why when the email is not failed or cannot be sent again", async () => {
    resendStaffEmail.mockResolvedValue({ ok: false, reason: "That email is not marked as failed.", refused: "not-failed" });
    const refused = await call({ kind: "paid", ...staff });
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toBe("That email is not marked as failed.");
    resendStaffEmail.mockResolvedValue({ ok: false, reason: "The email could not be sent again. Try again later.", refused: "send-failed" });
    expect((await call({ kind: "paid", ...staff })).status).toBe(502);
  });

  test("an unexpected error is reported as unconfirmed", async () => {
    resendStaffEmail.mockRejectedValue(new Error("db down"));
    expect((await call({ kind: "paid", ...staff })).status).toBe(503);
  });
});
