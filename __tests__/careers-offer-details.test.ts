import { describe, expect, test, vi } from "vitest";

import { OfferDetailsRefusal, createHrmsOfferDetailsGateway, emptyOfferDetails, saveOfferDetails, validateOfferDetails } from "@/lib/careers/offer-details";

const env = { HRMS_URL: "https://hrms.example.test/", CAREERS_CALLER_KEY: "caller-key" };
const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const full = { birthday: "1995-06-15", sex: "Female", civilStatus: "Single", sss: "34-1234567-8", philhealth: "123456789012", pagibigMid: "987654321012", tin: "123-456-789", emergencyName: "Maria Santos", emergencyRelationship: "Mother", emergencyMobile: "0917 123 4567" };

describe("validating Your details", () => {
  test("everything is optional", () => {
    expect(validateOfferDetails({})).toEqual({ ok: true, details: emptyOfferDetails });
  });

  test("cleans well-formed answers", () => {
    const result = validateOfferDetails(full);
    expect(result).toMatchObject({ ok: true, details: { sss: "34-1234567-8", emergencyMobile: "09171234567", emergencyName: "Maria Santos" } });
  });

  test("rejects malformed answers field by field", () => {
    const result = validateOfferDetails({ birthday: "2999-01-01", sss: "123", philhealth: "abc", tin: "1234567", emergencyMobile: "12345", emergencyName: "M4ria", sex: "F3male" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["birthday", "emergencyMobile", "emergencyName", "philhealth", "sex", "sss", "tin"]);
  });

  test("rejects impossible dates", () => {
    for (const birthday of ["2025-02-30", "0000-01-01", "not a date"]) expect(validateOfferDetails({ birthday }).ok).toBe(false);
  });
});

describe("HRMS offer-details gateway", () => {
  test("posts the answers for the Applicant with the caller key", async () => {
    const fetch = answer(200, { ok: true });
    await createHrmsOfferDetailsGateway({ env, fetch }).save({ offerId: 42, applicantId: "applicant-1", details: validateOfferDetails(full).ok ? (validateOfferDetails(full) as { details: typeof emptyOfferDetails }).details : emptyOfferDetails });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hrms.example.test/api/careers/offers/42/details");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer caller-key");
    expect(JSON.parse(init.body as string)).toEqual({
      applicantId: "applicant-1", birthday: "1995-06-15", sex: "Female", civilStatus: "Single",
      governmentIds: { sss: "34-1234567-8", philhealth: "123456789012", pagibigMid: "987654321012", tin: "123-456-789" },
      emergencyContact: { name: "Maria Santos", relationship: "Mother", mobile: "09171234567" },
    });
  });

  test("reads saved answers back, blank where unanswered", async () => {
    const fetch = answer(200, { details: { birthday: "1995-06-15", sex: null, civilStatus: null, governmentIds: { sss: "3412345678", philhealth: null, pagibigMid: null, tin: null }, emergencyContact: { name: "Maria", relationship: null, mobile: null } } });
    const details = await createHrmsOfferDetailsGateway({ env, fetch }).read({ offerId: 42, applicantId: "a b" });
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://hrms.example.test/api/careers/offers/42/details?applicantId=a%20b");
    expect(details).toEqual({ ...emptyOfferDetails, birthday: "1995-06-15", sss: "3412345678", emergencyName: "Maria" });
  });

  test("a refusal carries HRMS's message; other failures are plain and never carry the answers", async () => {
    const message = "This offer was declined, so documents can no longer be submitted.";
    const save = (fetch: typeof globalThis.fetch) => createHrmsOfferDetailsGateway({ env, fetch }).save({ offerId: 1, applicantId: "a", details: { ...emptyOfferDetails, sss: "3412345678" } });
    await expect(save(answer(409, { message }))).rejects.toMatchObject({ name: "OfferDetailsRefusal", message, status: 409 });
    for (const status of [401, 400, 503]) {
      const failure = save(answer(status, { message: "x" }));
      await expect(failure).rejects.not.toBeInstanceOf(OfferDetailsRefusal);
      await expect(failure).rejects.toThrow(`HRMS answered ${status}`);
    }
  });

  test("without HRMS_URL and the caller key it sends nothing", async () => {
    const fetch = answer(200);
    await expect(createHrmsOfferDetailsGateway({ env: {}, fetch }).read({ offerId: 1, applicantId: "a" })).rejects.toThrow("not configured");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("saving Your details", () => {
  const gateway = () => ({ read: vi.fn(), save: vi.fn(async () => {}) });

  test("sends the cleaned answers to HRMS", async () => {
    const g = gateway();
    expect(await saveOfferDetails({ applicantId: "a", offerId: 7, values: full }, { gateway: g })).toEqual({ ok: true });
    expect(g.save).toHaveBeenCalledWith({ offerId: 7, applicantId: "a", details: expect.objectContaining({ emergencyMobile: "09171234567" }) });
  });

  test("an invalid answer sends nothing and names the field", async () => {
    const g = gateway();
    const outcome = await saveOfferDetails({ applicantId: "a", offerId: 7, values: { ...full, sss: "1" } }, { gateway: g });
    expect(outcome).toMatchObject({ ok: false, errors: { sss: expect.any(String) } });
    expect(g.save).not.toHaveBeenCalled();
  });

  test("shows HRMS's refusal, and never logs the numbers on a failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const refused = { read: vi.fn(), save: vi.fn(async () => { throw new OfferDetailsRefusal("This offer was declined.", 409); }) };
    expect(await saveOfferDetails({ applicantId: "a", offerId: 7, values: full }, { gateway: refused })).toEqual({ ok: false, message: "This offer was declined." });
    const broken = { read: vi.fn(), save: vi.fn(async () => { throw new Error("HRMS answered 503"); }) };
    expect(await saveOfferDetails({ applicantId: "a", offerId: 7, values: full }, { gateway: broken })).toEqual({ ok: false, message: "We couldn't save your details. Try again." });
    expect(JSON.stringify(log.mock.calls)).not.toContain("34-1234567-8");
    log.mockRestore();
  });
});
