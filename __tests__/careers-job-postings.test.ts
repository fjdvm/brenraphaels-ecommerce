import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { jobPostings } from "../lib/careers/schema";
import { createJobPostingStore } from "../lib/careers/job-postings";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle-careers" });
});

afterEach(async () => {
  await client.close();
});

describe("HRMS-authored Job Postings", () => {
  test("reads a directly written Job Posting for public browsing", async () => {
    const store = createJobPostingStore(drizzle(client));

    await drizzle(client).insert(jobPostings).values({
        id: "ats-123",
        title: "Pastry Chef",
        department: "Kitchen",
        description: "Make heritage desserts.",
        requirements: "Three years of pastry experience.",
        employmentType: "Full-time",
        location: "Makati",
        deadline: new Date("2030-02-01T00:00:00.000Z"),
        requiredDocuments: ["Resume", "Portfolio"],
        screeningCriteria: ["Pastry experience"],
        responsibilities: ["Bake daily"],
        benefits: ["Free pastries"],
        status: "open",
    });

    await expect(store.listOpen()).resolves.toEqual([
      {
        id: "ats-123",
        title: "Pastry Chef",
        department: "Kitchen",
        description: "Make heritage desserts.",
        requirements: "Three years of pastry experience.",
        employmentType: "Full-time",
        location: "Makati",
        deadline: new Date("2030-02-01T00:00:00.000Z"),
        requiredDocuments: ["Resume", "Portfolio"],
        screeningCriteria: ["Pastry experience"],
        responsibilities: ["Bake daily"],
        benefits: ["Free pastries"],
      },
    ]);
  });

  test.each([
    ["draft", "2030-03-01T00:00:00.000Z"],
    ["closed", "2030-03-01T00:00:00.000Z"],
    ["filled", "2030-03-01T00:00:00.000Z"],
    ["open", "2000-01-01T00:00:00.000Z"],
  ])("hides a directly written %s Job Posting with deadline %s", async (status, deadline) => {
    const db = drizzle(client);
    const store = createJobPostingStore(db);
    await db.insert(jobPostings).values({
      id: "hrms-posting",
      title: "Pastry Chef",
      department: "Kitchen",
      description: "Make heritage desserts.",
      requirements: "Pastry experience.",
      employmentType: "Full-time",
      location: "Makati",
      deadline: new Date(deadline),
      requiredDocuments: ["Resume"],
      screeningCriteria: ["Pastry experience"],
      status,
    });

    await expect(store.listOpen()).resolves.toEqual([]);
    await expect(store.findOpen("hrms-posting")).resolves.toBeUndefined();
    await expect(store.listOpenFilterOptions()).resolves.toEqual({
      departments: [], employmentTypes: [], locations: [],
    });
    await expect(store.findById("hrms-posting")).resolves.toMatchObject({ id: "hrms-posting" });
  });

  test("updates, filters, and hides closed or expired Job Postings", async () => {
    const store = createJobPostingStore(drizzle(client));
    const posting = {
      id: "ats-456",
      title: "Retail Associate",
      department: "Retail",
      description: "Welcome shoppers.",
      requirements: "Customer service experience.",
      employmentType: "Part-time",
      location: "Quezon City",
      deadline: new Date("2030-03-01T00:00:00.000Z"),
      requiredDocuments: ["Resume"],
      screeningCriteria: ["Customer service"],
      status: "open" as const,
    };

    await drizzle(client).insert(jobPostings).values(posting);
    await drizzle(client).update(jobPostings).set({
      description: "Welcome shoppers and share our heritage flavors.",
    }).where(eq(jobPostings.id, posting.id));
    await drizzle(client).insert(jobPostings).values({
      ...posting,
      id: "ats-expired",
      department: "Kitchen",
      employmentType: "Full-time",
      location: "Makati",
      deadline: new Date("2000-01-01T00:00:00.000Z"),
    });

    await expect(store.listOpen({ department: "Retail", location: "Quezon City" })).resolves.toHaveLength(1);
    await expect(store.listOpen({ employmentType: "Full-time" })).resolves.toEqual([]);
    await expect(store.findOpen("ats-456")).resolves.toMatchObject({
      description: "Welcome shoppers and share our heritage flavors.",
    });
    await expect(store.listOpenFilterOptions()).resolves.toEqual({
      departments: ["Retail"],
      employmentTypes: ["Part-time"],
      locations: ["Quezon City"],
    });

    await drizzle(client).update(jobPostings).set({ status: "closed" }).where(eq(jobPostings.id, posting.id));
    await expect(store.listOpen()).resolves.toEqual([]);
    await expect(store.findOpen("ats-456")).resolves.toBeUndefined();
  });

  test("location options are distinct and come only from Open, not-past-deadline postings", async () => {
    const db = drizzle(client);
    const store = createJobPostingStore(db);
    const base = {
      title: "Role", department: "Kitchen", description: "d", requirements: "r", employmentType: "Full-time",
      deadline: new Date("2030-03-01T00:00:00.000Z"), requiredDocuments: [], screeningCriteria: [], status: "open" as const,
    };
    await db.insert(jobPostings).values([
      { ...base, id: "a", location: "Quezon City" },
      { ...base, id: "b", location: "Quezon City" },
      { ...base, id: "c", location: "Makati" },
      { ...base, id: "d", location: "Cebu", status: "draft" },
      { ...base, id: "e", location: "Davao", status: "closed" },
      { ...base, id: "f", location: "Baguio", status: "filled" },
      { ...base, id: "g", location: "Iloilo", deadline: new Date("2000-01-01T00:00:00.000Z") },
    ]);
    await expect(store.listOpenFilterOptions()).resolves.toMatchObject({ locations: ["Makati", "Quezon City"] });
  });

  test("findById still returns a closed or expired Job Posting, unlike findOpen", async () => {
    const store = createJobPostingStore(drizzle(client));
    const posting = {
      id: "ats-789",
      title: "Line Cook",
      department: "Kitchen",
      description: "Prep and cook heritage dishes.",
      requirements: "Line experience.",
      employmentType: "Full-time",
      location: "Makati",
      deadline: new Date("2000-01-01T00:00:00.000Z"),
      requiredDocuments: ["Resume"],
      screeningCriteria: ["Line experience"],
      status: "open" as const,
    };

    await drizzle(client).insert(jobPostings).values(posting);

    await expect(store.findOpen("ats-789")).resolves.toBeUndefined();
    await expect(store.findById("ats-789")).resolves.toMatchObject({ id: "ats-789", deadline: new Date("2000-01-01T00:00:00.000Z") });
    await expect(store.findById("ats-missing")).resolves.toBeUndefined();
  });
});
