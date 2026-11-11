import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { careersSession, revalidatePath } = vi.hoisted(() => ({ careersSession: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/applications", () => ({ createApplicationStore: vi.fn(), withdrawApplication: vi.fn() }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { requestRescheduleAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { stubInterviewRescheduleGateway } from "@/lib/careers/interview-reschedule";

const now = new Date("2026-11-12T00:00:00+08:00");
const form = (values: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ referenceNumber: "BR-APP-1", date: "2026-11-20", time: "14:00", ...values })) formData.set(key, value);
  return formData;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  careersSession.mockResolvedValue({ userId: "applicant-1" });
  vi.spyOn(stubInterviewRescheduleGateway, "request").mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("flag off", () => {
  test("says Coming soon and never reaches the gateway", async () => {
    await expect(requestRescheduleAction(form({}))).resolves.toEqual({ ok: false, message: "Coming soon. We'll email you the details." });
    expect(stubInterviewRescheduleGateway.request).not.toHaveBeenCalled();
  });
});

describe("flag on", () => {
  beforeEach(() => vi.stubEnv("CAREERS_OFFER_REPLIES_ENABLED", "true"));

  test("sends the preferred Manila time and a cleaned, optional note through the gateway", async () => {
    await expect(requestRescheduleAction(form({ note: "  Exam   that day. " }))).resolves.toEqual({ ok: true });
    expect(stubInterviewRescheduleGateway.request).toHaveBeenLastCalledWith({
      applicantId: "applicant-1",
      referenceNumber: "BR-APP-1",
      preferredAt: new Date("2026-11-20T14:00:00+08:00"),
      note: "Exam that day.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications");
    await expect(requestRescheduleAction(form({}))).resolves.toEqual({ ok: true });
    expect(stubInterviewRescheduleGateway.request).toHaveBeenLastCalledWith(expect.objectContaining({ note: "" }));
  });

  test.each([
    ["a past day", { date: "2026-11-11" }],
    ["a past year", { date: "2025-12-01" }],
    ["earlier today", { date: "2026-11-12", time: "00:00" }],
  ])("rejects %s before the gateway", async (_label, values) => {
    await expect(requestRescheduleAction(form(values))).resolves.toEqual({ ok: false, message: "Choose a day and time that haven't passed yet." });
    expect(stubInterviewRescheduleGateway.request).not.toHaveBeenCalled();
  });

  test.each([["not a date", { date: "tomorrow" }], ["an impossible day", { date: "2026-02-31" }], ["a bad time", { time: "25:00" }], ["markup in the note", { note: "<script>" }]])(
    "rejects %s",
    async (_label, values) => {
      await expect(requestRescheduleAction(form(values))).resolves.toMatchObject({ ok: false });
      expect(stubInterviewRescheduleGateway.request).not.toHaveBeenCalled();
    },
  );

  test("a gateway failure comes back as a retryable message", async () => {
    vi.mocked(stubInterviewRescheduleGateway.request).mockRejectedValue(new Error("down"));
    await expect(requestRescheduleAction(form({}))).resolves.toEqual({ ok: false, message: "We couldn't send your request. Try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("signed-out requests are refused", async () => {
    careersSession.mockResolvedValue(null);
    await expect(requestRescheduleAction(form({}))).resolves.toMatchObject({ ok: false });
    expect(stubInterviewRescheduleGateway.request).not.toHaveBeenCalled();
  });
});
