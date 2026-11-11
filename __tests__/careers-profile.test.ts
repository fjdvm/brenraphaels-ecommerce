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
      job_alerts_opt_in boolean not null default false,
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
        location: "Quezon City, Metro Manila",
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

describe("Applicant profile Location", () => {
  const identity = { userId: "career-auth-1", email: "jane@example.com" };
  const save = (store: ReturnType<typeof createApplicantProfileStore>, location: string) =>
    saveApplicantProfile({ fullName: "Jane Doe", location }, { identity, store });

  test("accepts a \"City, Province\" value from the directory", async () => {
    const store = createApplicantProfileStore(drizzle(client));
    await save(store, "Cebu City, Cebu");
    expect((await client.query("select location from applicant_profiles")).rows).toEqual([{ location: "Cebu City, Cebu" }]);
  });

  test("rejects text that is not in the directory with a message on the location field", async () => {
    const store = createApplicantProfileStore(drizzle(client));
    const error = await save(store, "Atlantis").catch((caught) => caught);
    expect(error.issues).toEqual([expect.objectContaining({ path: ["location"], message: "Choose a city from the list" })]);
    expect((await client.query("select 1 from applicant_profiles")).rows).toEqual([]);
  });

  test("keeps an existing free-text Location valid while unchanged, but not when it is edited to another", async () => {
    await client.exec("insert into applicant_profiles (applicant_id, full_name, email, location) values ('career-auth-1', 'Jane Doe', 'jane@example.com', 'Quezon City')");
    const store = createApplicantProfileStore(drizzle(client));
    await save(store, "Quezon City");
    expect((await client.query("select location from applicant_profiles")).rows).toEqual([{ location: "Quezon City" }]);
    await expect(save(store, "Quezon")).rejects.toThrow();
  });

  test("lets an Applicant clear the Location", async () => {
    const store = createApplicantProfileStore(drizzle(client));
    await save(store, "Cebu City, Cebu");
    await save(store, "");
    expect((await client.query("select location from applicant_profiles")).rows).toEqual([{ location: null }]);
  });
});
