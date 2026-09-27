import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createApplicantProfileStore, saveApplicantProfile } from "../lib/careers/profile";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await client.exec(`
    create table applicant_profiles (
      applicant_id text primary key,
      full_name text not null,
      email text not null unique,
      phone text,
      location text,
      summary text,
      skills text not null default '',
      updated_at timestamptz not null default now()
    );
    create table applicant_education (
      id integer generated always as identity primary key,
      applicant_id text not null references applicant_profiles(applicant_id) on delete cascade,
      school text not null, qualification text not null, field_of_study text, started_on text, completed_on text
    );
    create table applicant_work_history (
      id integer generated always as identity primary key,
      applicant_id text not null references applicant_profiles(applicant_id) on delete cascade,
      employer text not null, title text not null, started_on text, ended_on text, description text
    );
  `);
});

afterEach(async () => client.close());

describe("Applicant profile", () => {
  test("saves reusable personal information, education, work history, and skills", async () => {
    const store = createApplicantProfileStore(drizzle(client));

    await saveApplicantProfile(
      {
        fullName: "Jane Doe",
        phone: "09171234567",
        location: "Quezon City",
        summary: "Operations professional",
        skills: "Hiring, Excel",
        education: [{ school: "UP Diliman", qualification: "BA", fieldOfStudy: "Psychology" }],
        workHistory: [{ employer: "Bren Raphael", title: "Coordinator", startedOn: "2022-01" }],
      },
      { identity: { userId: "career-auth-1", email: "jane@example.com" }, store },
    );

    expect((await client.query("select full_name, skills from applicant_profiles")).rows).toEqual([
      { full_name: "Jane Doe", skills: "Hiring, Excel" },
    ]);
    expect((await client.query("select school, qualification from applicant_education")).rows).toEqual([
      { school: "UP Diliman", qualification: "BA" },
    ]);
    expect((await client.query("select employer, title from applicant_work_history")).rows).toEqual([
      { employer: "Bren Raphael", title: "Coordinator" },
    ]);
  });

  test("replaces an Applicant's reusable history when it is edited", async () => {
    const store = createApplicantProfileStore(drizzle(client));
    const identity = { userId: "career-auth-1", email: "jane@example.com" };
    await saveApplicantProfile({ fullName: "Jane Doe", skills: "Excel", education: [], workHistory: [] }, { identity, store });
    await saveApplicantProfile({ fullName: "Jane Doe", skills: "Excel, Hiring", education: [], workHistory: [{ employer: "New Co", title: "Lead" }] }, { identity, store });

    expect((await client.query("select skills from applicant_profiles")).rows).toEqual([
      { skills: "Excel, Hiring" },
    ]);
    expect((await client.query("select employer from applicant_work_history")).rows).toEqual([
      { employer: "New Co" },
    ]);
  });
});
