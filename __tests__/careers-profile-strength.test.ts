import { describe, expect, it } from "vitest";

import { profileStrength } from "@/app/(careers)/careers/(portal)/profile/profile-strength";

const profile = { fullName: "Jane Doe", phone: null, location: null, summary: null, skills: "", education: [], workHistory: [] };

describe("profileStrength", () => {
  it("is empty before a profile is saved", () => {
    const { percent, steps } = profileStrength({ documentCount: 0 });
    expect(percent).toBe(0);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("counts each completed part of the profile as a fifth", () => {
    expect(profileStrength({ profile, documentCount: 0 }).percent).toBe(20);
    expect(profileStrength({ profile, documentCount: 1 }).percent).toBe(40);
    expect(profileStrength({ profile: { ...profile, skills: "Baking" }, documentCount: 1 }).percent).toBe(60);
    expect(profileStrength({ profile: { ...profile, summary: "Cook", education: [{}], workHistory: [{}] } as never, documentCount: 1 }).percent).toBe(100);
  });

  it("names the parts in the order the page lists them", () => {
    expect(profileStrength({ documentCount: 0 }).steps.map((step) => step.label)).toEqual([
      "Basic information",
      "Résumé uploaded",
      "Summary & skills",
      "Education",
      "Work history",
    ]);
  });
});
