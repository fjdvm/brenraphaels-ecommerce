import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createJobPostingStore } from "../lib/careers/job-postings";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle-careers" });
});

afterEach(async () => {
  await client.close();
});

describe("Job Posting sync", () => {
  test("stores a created Job Posting for public browsing", async () => {
    const store = createJobPostingStore(drizzle(client));

    await store.applyEvent({
      event: "job_posting.created",
      data: {
        id: "ats-123",
        title: "Pastry Chef",
        department: "Kitchen",
        description: "Make heritage desserts.",
        requirements: "Three years of pastry experience.",
        employmentType: "Full-time",
        location: "Makati",
        deadline: "2030-02-01T00:00:00.000Z",
        requiredDocuments: ["Resume", "Portfolio"],
        screeningCriteria: ["Pastry experience"],
        status: "open",
      },
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
      },
    ]);
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
      deadline: "2030-03-01T00:00:00.000Z",
      requiredDocuments: ["Resume"],
      screeningCriteria: ["Customer service"],
      status: "open" as const,
    };

    await store.applyEvent({ event: "job_posting.created", data: posting });
    await store.applyEvent({
      event: "job_posting.updated",
      data: {
        ...posting,
        description: "Welcome shoppers and share our heritage flavors.",
      },
    });
    await store.applyEvent({
      event: "job_posting.created",
      data: {
        ...posting,
        id: "ats-expired",
        department: "Kitchen",
        employmentType: "Full-time",
        location: "Makati",
        deadline: "2000-01-01T00:00:00.000Z",
      },
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

    await store.applyEvent({ event: "job_posting.closed", data: posting });
    await expect(store.listOpen()).resolves.toEqual([]);
    await expect(store.findOpen("ats-456")).resolves.toBeUndefined();
  });
});
