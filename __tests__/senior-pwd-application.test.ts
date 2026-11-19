import { describe, expect, test, vi } from "vitest";

import { applicationProblem, parseSeniorPwdForm, submitSeniorPwdApplication } from "../lib/senior-pwd/application";
import { DEFAULT_DISCOUNT_RULE, describeRule, loadDiscountRule } from "../lib/senior-pwd/discount-rule";

vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));

const photo = (name = "id.png", type = "image/png", bytes = 4) => new File([new Uint8Array(bytes)], name, { type });
function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("the Senior/PWD question at sign-up", () => {
  test("must be answered", () => {
    expect(parseSeniorPwdForm(form({}))).toMatchObject({ ok: false, fieldErrors: { seniorPwd: [expect.stringContaining("Senior Citizen or PWD")] } });
  });

  test("a no needs nothing else", () => {
    expect(parseSeniorPwdForm(form({ seniorPwd: "no" }))).toEqual({ ok: true });
  });

  test("a yes needs the ID type, number and a front photo", () => {
    const result = parseSeniorPwdForm(form({ seniorPwd: "yes" }));
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? {} : Object.keys(result.fieldErrors).sort()).toEqual(["idFront", "idNumber", "idType"]);
  });

  test("a yes with everything gives the application; the back photo is optional", () => {
    const result = parseSeniorPwdForm(form({ seniorPwd: "yes", idType: "pwd", idNumber: "PWD-123456", idFront: photo("front.png") }));
    expect(result).toMatchObject({ ok: true, application: { idType: "pwd", idNumber: "PWD-123456" } });
    expect(result.ok && result.application?.back).toBeUndefined();
  });

  test("refuses a photo that is the wrong type or too big, and an ID number with stray characters", () => {
    const result = parseSeniorPwdForm(form({ seniorPwd: "yes", idType: "senior", idNumber: "<b>12", idFront: photo("a.gif", "image/gif"), idBack: photo("b.png", "image/png", 5 * 1024 * 1024 + 1) }));
    expect(result.ok ? {} : result.fieldErrors).toMatchObject({
      idNumber: [expect.any(String)],
      idFront: ["Upload a JPEG or PNG photo of your ID."],
      idBack: ["ID photos must be 5 MB or smaller."],
    });
  });

  test("Account settings assumes the yes, so it asks only for the ID", () => {
    expect(parseSeniorPwdForm(form({ idType: "senior", idNumber: "ANT-SC-1", idFront: photo() }), { required: false })).toMatchObject({ ok: true, application: { idType: "senior" } });
  });
});

describe("sending the ID for review", () => {
  const files = () => ({ upload: vi.fn(async (file: { filename: string }) => `file-${file.filename}`), remove: vi.fn(async () => {}) });
  const application = { idType: "senior" as const, idNumber: "ANT-SC-1", front: photo("front.png"), back: photo("back.png") };

  function database(options: { latest?: object; insertError?: Error }) {
    const rows = options.latest ? [options.latest] : [];
    const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => rows, returning: async () => [{ id: 1 }], values: async () => { if (options.insertError) throw options.insertError; return chain; } };
    return { select: () => chain, insert: () => ({ values: () => { if (options.insertError) throw options.insertError; return chain; } }) } as never;
  }

  test("stores both photos as temporary private files and records the ID", async () => {
    vi.stubEnv("SENIOR_PWD_ID_SECRET", "s".repeat(40));
    const storage = files();
    expect(await submitSeniorPwdApplication(database({}), "c1", application, storage)).toEqual({ status: "submitted" });
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.upload.mock.calls[0][0]).toMatchObject({ retentionType: "temporary", contentType: "image/png" });
    vi.unstubAllEnvs();
  });

  test("leaves an ID that is waiting or approved alone and uploads nothing", async () => {
    const storage = files();
    const outcome = await submitSeniorPwdApplication(database({ latest: { id: 3, customerId: "c1", idType: "pwd", status: "pending", submittedAt: new Date(), expiresOn: null } }), "c1", application, storage);
    expect(outcome.status).toBe("not-needed");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("removes the photos again when the ID cannot be recorded", async () => {
    vi.stubEnv("SENIOR_PWD_ID_SECRET", "s".repeat(40));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = files();
    const outcome = await submitSeniorPwdApplication(database({ insertError: new Error("down") }), "c1", application, storage);
    expect(outcome).toEqual({ status: "failed" });
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(applicationProblem(outcome)).toMatch(/couldn't send/);
    vi.unstubAllEnvs();
  });
});

describe("the CREOMS rule reader", () => {
  const reader = (rows: unknown) => ({ execute: async () => rows });
  test("reads the saved rule", async () => {
    const rule = await loadDiscountRule(reader([{ kind: "pesos", hundredths: "5000", limit: "150000", per: "month" }]));
    expect(rule).toEqual({ kind: "pesos", hundredths: 5000, limitInCentavos: 150000, per: "month" });
    expect(describeRule(rule)).toBe("₱50 off 1 item, up to ₱1500 per month");
  });
  test("falls back to 5% up to ₱125 a week when nothing valid can be read", async () => {
    expect(await loadDiscountRule(reader([]))).toEqual(DEFAULT_DISCOUNT_RULE);
    expect(await loadDiscountRule(reader([{ kind: "percent", hundredths: "20000", limit: "12500", per: "week" }]))).toEqual(DEFAULT_DISCOUNT_RULE);
    expect(await loadDiscountRule({ execute: async () => { throw new Error("no such table"); } })).toEqual(DEFAULT_DISCOUNT_RULE);
    expect(describeRule(DEFAULT_DISCOUNT_RULE)).toBe("5% off 1 item, up to ₱125 per week");
  });
});
