import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ submitApplicantProfile: vi.fn(), submitApplicantDocument: vi.fn() }));

import { Field } from "@/app/(careers)/careers/_components/field";
import { ApplicantProfileForm } from "@/app/(careers)/careers/(portal)/profile/applicant-profile-form";

const stars = (html: string) => (html.match(/text-red-600">\*/g) ?? []).length;

describe("Careers required-field markers", () => {
  it("shows a red star only on required fields, and the error when there is one", () => {
    expect(stars(renderToStaticMarkup(<Field id="a" label="Email" required><input id="a" /></Field>))).toBe(1);
    expect(stars(renderToStaticMarkup(<Field id="a" label="Phone"><input id="a" /></Field>))).toBe(0);
    expect(renderToStaticMarkup(<Field id="a" label="Email" required error="Enter a valid email address"><input id="a" /></Field>)).toContain("Enter a valid email address");
  });

  it("stars Full name and the Documents heading on the profile form", () => {
    const html = renderToStaticMarkup(<ApplicantProfileForm heading="Your applicant profile" fullName="Jane Doe" />);
    expect(html).toContain("Your applicant profile");
    expect(stars(html)).toBe(2);
  });

  it("stars every required field of an education and work-history entry", () => {
    const profile = { fullName: "Jane Doe", phone: null, location: null, summary: null, skills: "", education: [{ school: "UP", qualification: "BA", fieldOfStudy: null, startedOn: null, completedOn: null }], workHistory: [{ employer: "Co", title: "Lead", startedOn: null, endedOn: null, description: null }] };
    // Full name, School, Qualification, Employer, Job title, and the Documents heading
    expect(stars(renderToStaticMarkup(<ApplicantProfileForm heading="Profile" fullName="Jane" profile={profile} />))).toBe(6);
  });
});

describe("Applicant profile Location dropdown", () => {
  const noProfile = { fullName: "Jane", phone: null, summary: null, skills: "", education: [], workHistory: [] };

  it("renders Location as a searchable combobox that submits the chosen value", () => {
    const html = renderToStaticMarkup(<ApplicantProfileForm heading="Profile" fullName="Jane" profile={{ ...noProfile, location: "Cebu City, Cebu" }} locations={["Cebu City, Cebu", "Manila, Metro Manila"]} />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('placeholder="Search your city"');
    expect(html).toContain('name="location" value="Cebu City, Cebu"');
  });

  it("keeps a legacy free-text Location shown and submitted while unchanged", () => {
    const html = renderToStaticMarkup(<ApplicantProfileForm heading="Profile" fullName="Jane" profile={{ ...noProfile, location: "Quezon City" }} locations={["Cebu City, Cebu"]} />);
    expect(html).toContain('name="location" value="Quezon City"');
  });
});
