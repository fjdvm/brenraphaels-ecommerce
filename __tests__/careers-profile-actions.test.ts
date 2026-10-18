import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  careersSession,
  createApplicantProfileStore,
  saveApplicantProfile,
  createApplicationStore,
  createJobPostingStore,
  syncApplicationProfileSnapshots,
} = vi.hoisted(() => ({
  careersSession: vi.fn(),
  createApplicantProfileStore: vi.fn(),
  saveApplicantProfile: vi.fn(),
  createApplicationStore: vi.fn(),
  createJobPostingStore: vi.fn(),
  syncApplicationProfileSnapshots: vi.fn(),
}));

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn() }));
vi.mock("@/lib/careers/documents", () => ({
  createApplicantDocumentStore: vi.fn(),
  uploadApplicantDocument: vi.fn(),
}));
vi.mock("@/lib/careers/applications", () => ({
  createApplicationStore,
  syncApplicationProfileSnapshots,
}));
vi.mock("@/lib/careers/job-postings", () => ({
  createJobPostingStore,
}));
vi.mock("@/lib/careers/profile", () => ({
  createApplicantProfileStore,
  saveApplicantProfile,
}));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { z } from "zod";

import { submitApplicantProfile } from "@/app/(careers)/careers/(portal)/profile/actions";

describe("Applicant profile action", () => {
  beforeEach(() => {
    careersSession.mockReset();
    createApplicantProfileStore.mockReset();
    saveApplicantProfile.mockReset();
    createApplicationStore.mockReset();
    createJobPostingStore.mockReset();
    syncApplicationProfileSnapshots.mockReset();
  });

  test("refuses an unauthenticated profile submission before delegating", async () => {
    careersSession.mockResolvedValue(null);

    await expect(submitApplicantProfile({}, new FormData())).resolves.toEqual({
      message: "Please sign in to save your profile.",
    });
    expect(saveApplicantProfile).not.toHaveBeenCalled();
  });

  test("delegates normalized form values using the signed-in Applicant", async () => {
    const identity = { userId: "applicant-1", email: "jane@example.com" };
    const savedProfile = { fullName: "Jane Doe", skills: "Hiring", education: [{ school: "UP Diliman", qualification: "BA" }], workHistory: [] };
    careersSession.mockResolvedValue(identity);
    createApplicantProfileStore.mockReturnValue("profile-store");
    saveApplicantProfile.mockResolvedValue(savedProfile);
    createApplicationStore.mockReturnValue("application-store");
    createJobPostingStore.mockReturnValue("job-posting-store");
    syncApplicationProfileSnapshots.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("fullName", "Jane Doe");
    formData.set("skills", "Hiring");
    formData.set("school", "UP Diliman");
    formData.set("qualification", "BA");

    await submitApplicantProfile({}, formData);

    expect(saveApplicantProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Jane Doe",
        skills: "Hiring",
        education: [expect.objectContaining({ school: "UP Diliman", qualification: "BA" })],
      }),
      { identity, store: "profile-store" },
    );
    expect(syncApplicationProfileSnapshots).toHaveBeenCalledWith(
      "applicant-1",
      savedProfile,
      { applications: "application-store", postings: "job-posting-store" },
    );
  });

  test("still saves and redirects if syncing the edit into unfrozen Applications fails", async () => {
    const identity = { userId: "applicant-1", email: "jane@example.com" };
    careersSession.mockResolvedValue(identity);
    createApplicantProfileStore.mockReturnValue("profile-store");
    saveApplicantProfile.mockResolvedValue({ fullName: "Jane Doe" });
    createApplicationStore.mockReturnValue("application-store");
    createJobPostingStore.mockReturnValue("job-posting-store");
    syncApplicationProfileSnapshots.mockRejectedValue(new Error("Careers database unavailable"));
    const formData = new FormData();
    formData.set("fullName", "Jane Doe");

    await expect(submitApplicantProfile({}, formData)).resolves.toBeUndefined();
    expect(saveApplicantProfile).toHaveBeenCalled();
  });

  test("returns field errors keyed by the original row and keeps what was typed", async () => {
    careersSession.mockResolvedValue({ userId: "applicant-1", email: "jane@example.com" });
    createApplicantProfileStore.mockReturnValue("profile-store");
    saveApplicantProfile.mockRejectedValue(new z.ZodError([
      { code: "custom", path: ["education", 0, "qualification"], message: "Qualification is required" },
      { code: "custom", path: ["fullName"], message: "Full name is required" },
    ]));
    const formData = new FormData();
    for (const [key, value] of [["fullName", ""], ["school", ""], ["qualification", ""], ["school", "UP"], ["qualification", ""]]) formData.append(key, value);

    const state = await submitApplicantProfile({}, formData);

    // The first, fully blank row is skipped, so the filtered index 0 is the second row on screen.
    expect(state.fieldErrors).toEqual({ fullName: "Full name is required", "education-1-qualification": "Qualification is required" });
    expect(state.values?.education).toHaveLength(2);
    expect(saveApplicantProfile).toHaveBeenCalledWith(expect.objectContaining({ education: [expect.objectContaining({ school: "UP" })] }), expect.anything());
  });
});
