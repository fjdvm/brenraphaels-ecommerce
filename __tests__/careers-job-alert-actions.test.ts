import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { careersSession, getCareersDatabase } = vi.hoisted(() => ({ careersSession: vi.fn(), getCareersDatabase: vi.fn() }));
vi.mock("@/lib/careers/auth", () => ({ careersSession }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { setApplicantJobAlerts } from "@/app/(careers)/careers/(portal)/profile/actions";
import { createApplicantProfileStore, saveApplicantProfile } from "@/lib/careers/profile";

let client: PGlite;
const identity = { userId: "applicant-1", email: "jane@example.com" };
beforeEach(async () => {
  client = new PGlite();
  for (const file of ["0000_applicant_profile", "0001_careful_vector", "0002_aberrant_whizzer", "0003_premium_marrow", "0004_nostalgic_infant_terrible"]) {
    await client.exec(readFileSync(`drizzle-careers/${file}.sql`, "utf8"));
  }
  getCareersDatabase.mockReturnValue(drizzle(client));
  careersSession.mockResolvedValue(identity);
  await client.exec("INSERT INTO applicant_profiles (applicant_id, full_name, email) VALUES ('applicant-1', 'Jane Doe', 'jane@example.com')");
});
afterEach(async () => { vi.clearAllMocks(); await client.close(); });

test("existing and new Applicant profiles default to opted out after migration", async () => {
  await client.exec(readFileSync("drizzle-careers/0005_applicant_job_alerts.sql", "utf8"));
  const store = createApplicantProfileStore(drizzle(client));
  expect(await store.find(identity.userId)).toMatchObject({ jobAlertsOptIn: false });
  await saveApplicantProfile({ fullName: "John Doe" }, { identity: { userId: "applicant-2", email: "john@example.com" }, store });
  expect(await store.find("applicant-2")).toMatchObject({ jobAlertsOptIn: false });
});

test("opt in and opt out persist immediately, ignore supplied Applicant ids, and survive profile edits", async () => {
  await client.exec(readFileSync("drizzle-careers/0005_applicant_job_alerts.sql", "utf8"));
  const store = createApplicantProfileStore(drizzle(client));
  await saveApplicantProfile({ fullName: "John Doe" }, { identity: { userId: "applicant-2", email: "john@example.com" }, store });
  await expect(setApplicantJobAlerts({ jobAlertsOptIn: true, applicantId: "applicant-2" })).resolves.toEqual({ jobAlertsOptIn: true });
  expect(await store.find(identity.userId)).toMatchObject({ jobAlertsOptIn: true });
  expect(await store.find("applicant-2")).toMatchObject({ jobAlertsOptIn: false });
  await saveApplicantProfile({ fullName: "Jane Doe", skills: "Excel" }, { identity, store });
  expect(await store.find(identity.userId)).toMatchObject({ jobAlertsOptIn: true, skills: "Excel" });
  await expect(setApplicantJobAlerts({ jobAlertsOptIn: false })).resolves.toEqual({ jobAlertsOptIn: false });
  expect(await store.find(identity.userId)).toMatchObject({ jobAlertsOptIn: false });
});

test("signed-out Applicants cannot change a preference", async () => {
  careersSession.mockResolvedValue(null);
  getCareersDatabase.mockClear();
  await expect(setApplicantJobAlerts({ jobAlertsOptIn: true })).resolves.toEqual({ message: "Please sign in to change job-alert emails." });
  expect(getCareersDatabase).not.toHaveBeenCalled();
});

test.each([null, {}, { jobAlertsOptIn: "false" }, { jobAlertsOptIn: 1 }])("rejects invalid preference input %j", async (input) => {
  await client.exec(readFileSync("drizzle-careers/0005_applicant_job_alerts.sql", "utf8"));
  await expect(setApplicantJobAlerts(input)).resolves.toEqual({ message: "Choose whether to receive job-alert emails." });
  expect(await createApplicantProfileStore(drizzle(client)).find(identity.userId)).toMatchObject({ jobAlertsOptIn: false });
});

test("does not report success for an Applicant without a profile", async () => {
  await client.exec(readFileSync("drizzle-careers/0005_applicant_job_alerts.sql", "utf8"));
  careersSession.mockResolvedValue({ userId: "missing-profile", email: "other@example.com" });
  await expect(setApplicantJobAlerts({ jobAlertsOptIn: true })).resolves.toEqual({ message: "Complete your Applicant profile before changing job-alert emails." });
});

test("reports a persistence failure so the caller can retry", async () => {
  getCareersDatabase.mockImplementationOnce(() => { throw new Error("Database unavailable"); });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(setApplicantJobAlerts({ jobAlertsOptIn: true })).resolves.toEqual({ message: "We couldn't save your job-alert preference. Try again." });
  } finally { log.mockRestore(); }
});
