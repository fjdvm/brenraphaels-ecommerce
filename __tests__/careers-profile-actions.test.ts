import { beforeEach, describe, expect, test, vi } from "vitest";

const { careersSession, createApplicantProfileStore, saveApplicantProfile } = vi.hoisted(
  () => ({
    careersSession: vi.fn(),
    createApplicantProfileStore: vi.fn(),
    saveApplicantProfile: vi.fn(),
  }),
);

vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: vi.fn() }));
vi.mock("@/lib/careers/documents", () => ({
  createApplicantDocumentStore: vi.fn(),
  uploadApplicantDocument: vi.fn(),
}));
vi.mock("@/lib/careers/profile", () => ({
  createApplicantProfileStore,
  saveApplicantProfile,
}));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { submitApplicantProfile } from "@/app/(careers)/careers/profile/actions";

describe("Applicant profile action", () => {
  beforeEach(() => {
    careersSession.mockReset();
    createApplicantProfileStore.mockReset();
    saveApplicantProfile.mockReset();
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
    careersSession.mockResolvedValue(identity);
    createApplicantProfileStore.mockReturnValue("profile-store");
    saveApplicantProfile.mockResolvedValue(undefined);
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
  });
});
