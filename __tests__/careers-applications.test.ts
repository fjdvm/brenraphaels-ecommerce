import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createApplicationStore, submitApplication, withdrawApplication } from "../lib/careers/applications";

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
    enqueueDelivery: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Application submission", () => {
  test("records a verified Applicant's complete local Application and emails its permanent Reference number", async () => {
    const input = dependencies();

    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: true });

    expect((await client.query("select applicant_id, job_posting_id, reference_number, status, profile_snapshot, documents_snapshot from applications")).rows).toEqual([
      {
        applicant_id: "applicant-1", job_posting_id: "ats-1", reference_number: "BR-20260928-0001", status: "Received",
        profile_snapshot: profile, documents_snapshot: [{ ...documents[0], requiredFor: "Resume" }],
      },
    ]);
    expect(input.sendConfirmationEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ referenceNumber: "BR-20260928-0001", jobTitle: "Pastry Chef" }));
    expect(input.enqueueDelivery).toHaveBeenCalledWith({
      type: "application.submitted",
      referenceNumber: "BR-20260928-0001",
      jobPostingId: "ats-1",
      profileSnapshot: profile,
      documentsSnapshot: [{ ...documents[0], requiredFor: "Resume" }],
      consentedAt: expect.any(String),
    });
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
    await expect(withdrawApplication("BR-20260928-0001", input.applications, "applicant-1", input.enqueueDelivery)).resolves.toEqual({ status: "Withdrawn" });
    expect(input.enqueueDelivery).toHaveBeenCalledWith({ type: "application.withdrawn", referenceNumber: "BR-20260928-0001" });
    await expect(withdrawApplication("BR-20260928-0001", input.applications, "another-applicant", input.enqueueDelivery)).rejects.toThrow("Application not found.");
  });

  test("does not withdraw an Application again, or enqueue a delivery, if enqueuing already failed once", async () => {
    const input = dependencies({ enqueueDelivery: vi.fn().mockRejectedValue(new Error("Vercel Queues unavailable")) });
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);

    await expect(withdrawApplication("BR-20260928-0001", input.applications, "applicant-1", input.enqueueDelivery)).resolves.toEqual({ status: "Withdrawn" });
    expect((await client.query("select status from applications")).rows).toEqual([{ status: "Withdrawn" }]);
  });

  test("does not let an Applicant withdraw an Application after a final decision", async () => {
    const input = dependencies();
    await submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input);
    await client.exec("update applications set status = 'Rejected' where reference_number = 'BR-20260928-0001'");

    await expect(withdrawApplication("BR-20260928-0001", input.applications, "applicant-1", input.enqueueDelivery)).rejects.toThrow(
      "This Application has reached a final status and cannot be withdrawn.",
    );
  });

  test("keeps the permanent Reference number visible if confirmation email delivery fails", async () => {
    const input = dependencies({ sendConfirmationEmail: vi.fn().mockRejectedValue(new Error("Brevo unavailable")) });

    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: false });
    expect((await client.query("select reference_number, status from applications")).rows).toEqual([{ reference_number: "BR-20260928-0001", status: "Received" }]);
  });

  test("records the Application and still emails the Applicant if enqueuing HR-ATS delivery fails", async () => {
    const input = dependencies({ enqueueDelivery: vi.fn().mockRejectedValue(new Error("Vercel Queues unavailable")) });

    await expect(submitApplication({ jobPostingId: "ats-1", documentIds: [7], consent: true }, input)).resolves.toEqual({ referenceNumber: "BR-20260928-0001", confirmationEmailSent: true });
    expect((await client.query("select reference_number, status from applications")).rows).toEqual([{ reference_number: "BR-20260928-0001", status: "Received" }]);
    expect(input.sendConfirmationEmail).toHaveBeenCalled();
  });
});
