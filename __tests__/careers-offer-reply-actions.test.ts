import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { careersSession, revalidatePath, findOfferForApplicant, reply } = vi.hoisted(() => ({
  careersSession: vi.fn(), revalidatePath: vi.fn(), findOfferForApplicant: vi.fn(), reply: vi.fn(),
}));

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/applications", () => ({ createApplicationStore: vi.fn(() => ({ findOfferForApplicant })), withdrawApplication: vi.fn() }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
// The fake HRMS client: the real gateway's wire format is covered in its own test.
vi.mock("@/lib/careers/offer-reply", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/careers/offer-reply")>()), createHrmsOfferReplyGateway: () => ({ reply }) }));

import { acceptOfferAction, declineOfferAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { OfferReplyRefusal } from "@/lib/careers/offer-reply";

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  careersSession.mockResolvedValue({ userId: "applicant-1" });
  findOfferForApplicant.mockResolvedValue({ id: 42, status: "Sent" });
  reply.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("flag off", () => {
  test("accept and decline say Coming soon and never reach HRMS", async () => {
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "Coming soon. We'll email you the details." });
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toMatchObject({ ok: false });
    expect(reply).not.toHaveBeenCalled();
    expect(findOfferForApplicant).not.toHaveBeenCalled();
  });
});

describe("flag on", () => {
  beforeEach(() => vi.stubEnv("CAREERS_OFFER_REPLIES_ENABLED", "true"));

  test("accept tells HRMS the signed-in Applicant accepted their own Offer", async () => {
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: true });
    expect(findOfferForApplicant).toHaveBeenCalledWith("applicant-1", "BR-APP-1");
    expect(reply).toHaveBeenCalledWith({ offerId: 42, applicantId: "applicant-1", answer: "Accepted" });
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications");
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications/BR-APP-1");
  });

  test("decline tells HRMS the Applicant declined", async () => {
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: true });
    expect(reply).toHaveBeenCalledWith({ offerId: 42, applicantId: "applicant-1", answer: "Declined" });
  });

  test("the Applicant is the signed-in one, never something sent in the form", async () => {
    await acceptOfferAction(form({ referenceNumber: "BR-APP-1", applicantId: "someone-else", offerId: "999" }));
    expect(reply).toHaveBeenCalledWith({ offerId: 42, applicantId: "applicant-1", answer: "Accepted" });
  });

  test("an answered Offer cannot be answered again, and HRMS is not called", async () => {
    for (const status of ["Accepted", "Declined"]) {
      findOfferForApplicant.mockResolvedValue({ id: 42, status });
      await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "This offer has already been answered. A reply is final." });
      await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toMatchObject({ ok: false });
    }
    expect(reply).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("no Offer for this Application (a Draft, or someone else's) is refused", async () => {
    findOfferForApplicant.mockResolvedValue(undefined);
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "We couldn't find an offer for this application." });
    expect(reply).not.toHaveBeenCalled();
  });

  test("HRMS's refusal is shown in its own words and nothing is refreshed", async () => {
    reply.mockRejectedValue(new OfferReplyRefusal("This application was withdrawn, so the offer allows no further action.", 409));
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "This application was withdrawn, so the offer allows no further action." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("an HRMS failure comes back as a retryable message and nothing is recorded", async () => {
    reply.mockRejectedValue(new Error("down"));
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "We couldn't accept your offer. Try again." });
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "We couldn't decline your offer. Try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("an unreadable Offer asks to try again", async () => {
    findOfferForApplicant.mockRejectedValue(new Error("db"));
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "We couldn't load your offer. Try again." });
    expect(reply).not.toHaveBeenCalled();
  });

  test("an invalid Reference number is refused before anything is read", async () => {
    await expect(acceptOfferAction(form({ referenceNumber: "<script>" }))).resolves.toMatchObject({ ok: false });
    expect(findOfferForApplicant).not.toHaveBeenCalled();
  });

  test("signed-out requests are refused", async () => {
    careersSession.mockResolvedValue(null);
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toMatchObject({ ok: false });
    expect(reply).not.toHaveBeenCalled();
  });
});
