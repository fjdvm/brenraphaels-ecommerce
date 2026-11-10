import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createApplicationStore,
  isApplicationFrozen,
  submitApplication,
  syncApplicationProfileSnapshots,
  withdrawApplication,
} from "../lib/careers/applications";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await client.exec(`
    create table applications (
      id integer generated always as identity primary key,
      applicant_id text not null,
      job_posting_id text not null,
      reference_number text not null unique,
      status text not null,
      profile_snapshot jsonb not null,
      documents_snapshot jsonb not null,
      consented_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (applicant_id, job_posting_id)
    );
  `);
});

afterEach(async () => client.close());

const profile = { fullName: "Jane Doe", phone: "09171234567", location: "Quezon City", summary: null, skills: "Baking", education: [], workHistory: [] };
const documents = [{ id: 7, name: "resume.pdf", contentType: "application/pdf", size: 100 }];
const posting = { id: "ats-1", title: "Pastry Chef", requiredDocuments: ["Resume"] };

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    identity: { userId: "applicant-1", email: "jane@example.com", verified: true },
    profile: { find: vi.fn().mockResolvedValue(profile) },
    documents: { list: vi.fn().mockResolvedValue(documents) },
    postings: { findOpen: vi.fn().mockResolvedValue(posting) },
    applications: createApplicationStore(drizzle(client)),
    makeReferenceNumber: vi.fn().mockReturnValue("BR-20260928-0001"),
    sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    enqueueDelivery: vi.fn().mockResolvedValue(undefined), // Legacy delivery boundary must stay unused.
    ...overrides,
  };
}

describe("Application submission", () => {
  test("saves a verified Applicant's Application and emails its Reference number without outbound delivery", async () => {
    const input = dependencies();

    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: true });

    expect((await client.query("select applicant_id, job_posting_id, reference_number, status, profile_snapshot, documents_snapshot from applications")).rows).toEqual([
      {
        applicant_id: "applicant-1", job_posting_id: "ats-1", reference_number: "BR-20260928-0001", status: "Received",
        profile_snapshot: profile, documents_snapshot: [{ ...documents[0], requiredFor: "Resume" }],
      },
    ]);
    expect(input.sendConfirmationEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ referenceNumber: "BR-20260928-0001", jobTitle: "Pastry Chef" }));
    expect(input.enqueueDelivery).not.toHaveBeenCalled();
  });

  test("blocks unverified, incomplete, missing-document, duplicate, and non-consenting submissions locally", async () => {
    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, dependencies({ identity: { userId: "applicant-1", email: "jane@example.com", verified: false } }))).rejects.toThrow("Verify your email before applying.");
    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, dependencies({ profile: { find: vi.fn().mockResolvedValue(null) } }))).rejects.toThrow("Complete your Applicant profile before applying.");
    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [], consent: true }, dependencies())).rejects.toThrow("Select a Document for every required document.");
    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: false }, dependencies())).rejects.toThrow("Consent to the data-privacy notice before submitting.");

    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).rejects.toThrow("You have already applied to this Job Posting.");
  });

  test("lists Applications and lets an Applicant withdraw until a final status", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);

    await expect(input.applications.listForApplicant("applicant-1")).resolves.toEqual([
      expect.objectContaining({ referenceNumber: "BR-20260928-0001", status: "Received", jobPostingId: "ats-1" }),
    ]);
    await expect(withdrawApplication("BR-20260928-0001", input.applications, "applicant-1")).resolves.toEqual({ status: "Withdrawn" });
    expect(input.enqueueDelivery).not.toHaveBeenCalled();
    await expect(input.applications.listForApplicant("applicant-1")).resolves.toEqual([expect.objectContaining({ status: "Withdrawn" })]);
    await expect(withdrawApplication("BR-20260928-0001", input.applications, "another-applicant")).rejects.toThrow("Application not found.");
  });

  test("does not let an Applicant withdraw an Application after a final decision", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    await client.exec("update applications set status = 'Rejected' where reference_number = 'BR-20260928-0001'");

    await expect(withdrawApplication("BR-20260928-0001", input.applications, "applicant-1")).rejects.toThrow(
      "This Application has reached a final status and cannot be withdrawn.",
    );
  });

  test("keeps the permanent Reference number visible if confirmation email delivery fails", async () => {
    const input = dependencies({ sendConfirmationEmail: vi.fn().mockRejectedValue(new Error("Brevo unavailable")) });

    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: false });
    expect((await client.query("select reference_number, status from applications")).rows).toEqual([{ reference_number: "BR-20260928-0001", status: "Received" }]);
  });
});

describe("Application status webhook sync", () => {
  test("mirrors an HR-ATS status change into the local read-model by Reference number", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);

    await expect(input.applications.updateStatus("BR-20260928-0001", "Interviewing")).resolves.toBe(true);
    expect((await client.query("select status from applications")).rows).toEqual([{ status: "Interviewing" }]);

    await expect(input.applications.updateStatus("BR-does-not-exist", "Interviewing")).resolves.toBe(false);
  });
});

describe("Application isApplicationFrozen", () => {
  const future = new Date("2030-01-01T00:00:00.000Z");
  const past = new Date("2000-01-01T00:00:00.000Z");

  test("is unfrozen only while still Received and before the Job Posting's deadline", () => {
    expect(isApplicationFrozen("Received", future)).toBe(false);
  });

  test("freezes the instant HR-ATS marks the status past Received", () => {
    expect(isApplicationFrozen("Interviewing", future)).toBe(true);
  });

  test("freezes the instant the Job Posting's deadline passes, even while still Received", () => {
    expect(isApplicationFrozen("Received", past)).toBe(true);
  });
});

describe("Applicant profile edits and the Frozen rule", () => {
  test("updates an unfrozen Application's snapshot in the window before either freeze trigger fires", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    const editedProfile = { ...profile, summary: "Updated after submitting" };

    await syncApplicationProfileSnapshots("applicant-1", editedProfile, {
      applications: input.applications,
      postings: { findById: vi.fn().mockResolvedValue({ id: "ats-1", deadline: new Date("2030-01-01T00:00:00.000Z") }) },
    });

    expect((await client.query("select profile_snapshot from applications")).rows).toEqual([{ profile_snapshot: editedProfile }]);
  });

  test("leaves a Frozen Application's snapshot unchanged once HR-ATS marks its status past Received", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    await input.applications.updateStatus("BR-20260928-0001", "Interviewing");
    const findById = vi.fn().mockResolvedValue({ id: "ats-1", deadline: new Date("2030-01-01T00:00:00.000Z") });

    await syncApplicationProfileSnapshots("applicant-1", { ...profile, summary: "Should not apply" }, {
      applications: input.applications,
      postings: { findById },
    });

    expect((await client.query("select profile_snapshot from applications")).rows).toEqual([{ profile_snapshot: profile }]);
    expect(findById).not.toHaveBeenCalled();
  });

  test("leaves a Frozen Application's snapshot unchanged once its Job Posting's deadline has passed", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);

    await syncApplicationProfileSnapshots("applicant-1", { ...profile, summary: "Should not apply" }, {
      applications: input.applications,
      postings: { findById: vi.fn().mockResolvedValue({ id: "ats-1", deadline: new Date("2000-01-01T00:00:00.000Z") }) },
    });

    expect((await client.query("select profile_snapshot from applications")).rows).toEqual([{ profile_snapshot: profile }]);
  });

  test("still applies the edit to another still-unfrozen Application and does not touch other Applicants' Applications", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    await input.applications.insert({
      applicantId: "applicant-1",
      jobPostingId: "ats-2",
      referenceNumber: "BR-20260928-0002",
      status: "Received",
      profileSnapshot: profile,
      documentsSnapshot: [],
      consentedAt: new Date(),
    });
    await input.applications.insert({
      applicantId: "another-applicant",
      jobPostingId: "ats-1",
      referenceNumber: "BR-20260928-0003",
      status: "Received",
      profileSnapshot: profile,
      documentsSnapshot: [],
      consentedAt: new Date(),
    });
    await input.applications.updateStatus("BR-20260928-0001", "Interviewing");
    const editedProfile = { ...profile, summary: "Updated after submitting" };

    await syncApplicationProfileSnapshots("applicant-1", editedProfile, {
      applications: input.applications,
      postings: { findById: vi.fn().mockResolvedValue({ id: "ats-2", deadline: new Date("2030-01-01T00:00:00.000Z") }) },
    });

    expect((await client.query("select reference_number, profile_snapshot from applications order by reference_number")).rows).toEqual([
      { reference_number: "BR-20260928-0001", profile_snapshot: profile },
      { reference_number: "BR-20260928-0002", profile_snapshot: editedProfile },
      { reference_number: "BR-20260928-0003", profile_snapshot: profile },
    ]);
  });
});
