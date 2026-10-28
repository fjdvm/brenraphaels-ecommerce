import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createApplicationStore } from "../lib/careers/applications";

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
    create table job_postings (
      id text primary key,
      title text not null,
      department text not null,
      employment_type text not null,
      location text not null
    );
    insert into job_postings values
      ('p1', 'Production Assistant', 'Kitchen', 'Full-time', 'Quezon City'),
      ('p2', 'Seasonal Packer', 'Kitchen', 'Contract', 'Quezon City');
    insert into applications (applicant_id, job_posting_id, reference_number, status, profile_snapshot, documents_snapshot, consented_at, created_at) values
      ('a1', 'p1', 'BR-1', 'Received', '{}', '[]', now(), '2026-09-02T00:00:00Z'),
      ('a1', 'p2', 'BR-2', 'Rejected', '{}', '[]', now(), '2026-10-18T00:00:00Z'),
      ('a1', 'gone', 'BR-3', 'Received', '{}', '[]', now(), '2026-08-01T00:00:00Z'),
      ('a2', 'p1', 'BR-4', 'Received', '{}', '[]', now(), '2026-10-01T00:00:00Z');
  `);
});

afterEach(async () => client.close());

describe("Application summaries", () => {
  test("lists an Applicant's own Applications newest first with their Job Posting details", async () => {
    const summaries = await createApplicationStore(drizzle(client)).listSummariesForApplicant("a1");

    expect(summaries.map((summary) => summary.referenceNumber)).toEqual(["BR-2", "BR-1", "BR-3"]);
    expect(summaries[0]).toMatchObject({ status: "Rejected", title: "Seasonal Packer", department: "Kitchen", employmentType: "Contract", location: "Quezon City" });
    expect(summaries[0].appliedAt).toEqual(new Date("2026-10-18T00:00:00Z"));
  });

  test("keeps an Application whose Job Posting can no longer be read", async () => {
    const summaries = await createApplicationStore(drizzle(client)).listSummariesForApplicant("a1");

    expect(summaries[2]).toMatchObject({ referenceNumber: "BR-3", title: null, department: null });
  });
});
