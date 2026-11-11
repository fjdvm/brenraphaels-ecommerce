import { beforeEach, describe, expect, test, vi } from "vitest";

const { careersSession, submitApplication, withdrawApplication, createApplicationStore, createApplicantProfileStore, createApplicantDocumentStore, createJobPostingStore, sendApplicationReceivedEmail, revalidatePath } = vi.hoisted(() => ({
  careersSession: vi.fn(), submitApplication: vi.fn(), withdrawApplication: vi.fn(), createApplicationStore: vi.fn(), createApplicantProfileStore: vi.fn(), createApplicantDocumentStore: vi.fn(), createJobPostingStore: vi.fn(), sendApplicationReceivedEmail: vi.fn(), revalidatePath: vi.fn(),
}));

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/applications", () => ({ createApplicationStore, submitApplication, withdrawApplication }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn(() => "database") }));
vi.mock("@/lib/careers/profile", () => ({ createApplicantProfileStore }));
vi.mock("@/lib/careers/documents", () => ({ createApplicantDocumentStore }));
vi.mock("@/lib/careers/job-postings", () => ({ createJobPostingStore }));
vi.mock("@/lib/email/application-received-email", () => ({ sendApplicationReceivedEmail }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { submitApplicationAction } from "@/app/(careers)/careers/(portal)/[id]/apply/actions";
import { withdrawApplicationAction } from "@/app/(careers)/careers/(portal)/applications/actions";

describe("Application action", () => {
  beforeEach(() => vi.resetAllMocks());

  test("refuses an unauthenticated submission before delegating", async () => {
    careersSession.mockResolvedValue(null);
    await expect(submitApplicationAction({}, new FormData())).resolves.toEqual({ message: "Please sign in before applying." });
    expect(submitApplication).not.toHaveBeenCalled();
  });

  test("validates the form and delegates with the signed-in Applicant", async () => {
    const formData = new FormData();
    formData.set("jobPostingId", "ats-1");
    formData.append("documentId", "7");
    formData.set("privacyConsent", "yes");
    const identity = { userId: "applicant-1", email: "jane@example.com", verified: true };
    careersSession.mockResolvedValue(identity);
    createApplicationStore.mockReturnValue("applications");
    createApplicantProfileStore.mockReturnValue("profile");
    createApplicantDocumentStore.mockReturnValue("documents");
    createJobPostingStore.mockReturnValue("postings");
    submitApplication.mockResolvedValue({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: true });

    await expect(submitApplicationAction({}, formData)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: true, sentAt: expect.any(String) });
    expect(submitApplication).toHaveBeenCalledWith(
      { jobPostingId: "ats-1", documentIds: [7], consent: true },
      expect.objectContaining({ identity, applications: "applications", profile: "profile", documents: "documents", postings: "postings", sendConfirmationEmail: sendApplicationReceivedEmail }),
    );
  });

  test("rejects malformed document identifiers before delegating", async () => {
    const formData = new FormData();
    formData.set("jobPostingId", "ats-1");
    formData.append("documentId", "7.5");
    careersSession.mockResolvedValue({ userId: "applicant-1", email: "jane@example.com", verified: true });

    await expect(submitApplicationAction({}, formData)).resolves.toEqual({ message: "Choose a valid Job Posting and Documents." });
    expect(submitApplication).not.toHaveBeenCalled();
  });

  test("validates and delegates withdrawal using the signed-in Applicant", async () => {
    const formData = new FormData();
    formData.set("referenceNumber", "BR-20260928-0001");
    careersSession.mockResolvedValue({ userId: "applicant-1", email: "jane@example.com", verified: true });
    createApplicationStore.mockReturnValue("applications");

    await expect(withdrawApplicationAction(formData)).resolves.toEqual({ ok: true });

    expect(withdrawApplication).toHaveBeenCalledWith("BR-20260928-0001", "applications", "applicant-1");
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications");
  });

  test("does not withdraw with an unauthenticated Applicant or invalid reference", async () => {
    careersSession.mockResolvedValue(null);
    await expect(withdrawApplicationAction(new FormData())).resolves.toMatchObject({ ok: false });
    expect(withdrawApplication).not.toHaveBeenCalled();
  });

  test("reports a failed withdrawal so the card can offer Retry", async () => {
    const formData = new FormData();
    formData.set("referenceNumber", "BR-20260928-0001");
    careersSession.mockResolvedValue({ userId: "applicant-1", email: "jane@example.com", verified: true });
    withdrawApplication.mockRejectedValue(new Error("status moved on"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(withdrawApplicationAction(formData)).resolves.toMatchObject({ ok: false, message: expect.any(String) });
    expect(revalidatePath).toHaveBeenCalledWith("/careers/applications");
  });
});
