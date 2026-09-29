import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(careers)/careers/profile/actions", () => ({ submitApplicantProfile: vi.fn(), submitApplicantDocument: vi.fn() }));

import { Field } from "@/app/(careers)/careers/_components/field";
import { ApplicantProfileForm } from "@/app/(careers)/careers/profile/applicant-profile-form";

const stars = (html: string) => (html.match(/text-red-600">\*/g) ?? []).length;

describe("Careers required-field markers", () => {
  it("shows a red star only on required fields, and the error when there is one", () => {
    expect(stars(renderToStaticMarkup(<Field id="a" label="Email" required><input id="a" /></Field>))).toBe(1);
    expect(stars(renderToStaticMarkup(<Field id="a" label="Phone"><input id="a" /></Field>))).toBe(0);
    expect(renderToStaticMarkup(<Field id="a" label="Email" required error="Enter a valid email address"><input id="a" /></Field>)).toContain("Enter a valid email address");
  });

  it("stars Full name on the profile form (plus the legend) and links back to Careers", () => {
    const html = renderToStaticMarkup(<ApplicantProfileForm heading="Your Applicant profile" fullName="Jane Doe" />);
    expect(html).toContain('href="/careers"');
    expect(html).toContain("Back");
    expect(stars(html)).toBe(2);
  });

  it("stars every required field of an education and work-history entry", () => {
    const profile = { fullName: "Jane Doe", phone: null, location: null, summary: null, skills: "", education: [{ school: "UP", qualification: "BA", fieldOfStudy: null, startedOn: null, completedOn: null }], workHistory: [{ employer: "Co", title: "Lead", startedOn: null, endedOn: null, description: null }] };
    // two legends (profile + document forms) + Full name, School, Qualification, Employer, Job title, Document
    expect(stars(renderToStaticMarkup(<ApplicantProfileForm heading="Profile" fullName="Jane" profile={profile} />))).toBe(8);
  });
});
