import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { careersSession, revalidatePath } = vi.hoisted(() => ({ careersSession: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/applications", () => ({ createApplicationStore: vi.fn(), withdrawApplication: vi.fn() }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { acceptOfferAction, declineOfferAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { stubOfferReplyGateway } from "@/lib/careers/offer-reply";

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  careersSession.mockResolvedValue({ userId: "applicant-1" });
  vi.spyOn(stubOfferReplyGateway, "accept").mockResolvedValue(undefined);
  vi.spyOn(stubOfferReplyGateway, "decline").mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("flag off", () => {
  test("accept and decline say Coming soon and never reach the gateway", async () => {
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "Coming soon. We'll email you the details." });
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toMatchObject({ ok: false });
    expect(stubOfferReplyGateway.accept).not.toHaveBeenCalled();
    expect(stubOfferReplyGateway.decline).not.toHaveBeenCalled();
  });
});

describe("flag on", () => {
  beforeEach(() => vi.stubEnv("CAREERS_OFFER_REPLIES_ENABLED", "true"));

  test("accept goes through the gateway for the signed-in Applicant", async () => {
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: true });
    expect(stubOfferReplyGateway.accept).toHaveBeenCalledWith({ applicantId: "applicant-1", referenceNumber: "BR-APP-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications");
  });

  test("decline sends the cleaned reason, which is optional", async () => {
    await declineOfferAction(form({ referenceNumber: "BR-APP-1", reason: "  Found   another role. " }));
    expect(stubOfferReplyGateway.decline).toHaveBeenLastCalledWith({ applicantId: "applicant-1", referenceNumber: "BR-APP-1", reason: "Found another role." });
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: true });
    expect(stubOfferReplyGateway.decline).toHaveBeenLastCalledWith({ applicantId: "applicant-1", referenceNumber: "BR-APP-1", reason: "" });
  });

  test("a reason with disallowed characters is rejected before the gateway", async () => {
    await expect(declineOfferAction(form({ referenceNumber: "BR-APP-1", reason: "<script>" }))).resolves.toMatchObject({ ok: false });
    expect(stubOfferReplyGateway.decline).not.toHaveBeenCalled();
  });

  test("a gateway failure comes back as a retryable message", async () => {
    vi.mocked(stubOfferReplyGateway.accept).mockRejectedValue(new Error("down"));
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toEqual({ ok: false, message: "We couldn't accept your offer. Try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("signed-out requests are refused", async () => {
    careersSession.mockResolvedValue(null);
    await expect(acceptOfferAction(form({ referenceNumber: "BR-APP-1" }))).resolves.toMatchObject({ ok: false });
    expect(stubOfferReplyGateway.accept).not.toHaveBeenCalled();
  });
});
