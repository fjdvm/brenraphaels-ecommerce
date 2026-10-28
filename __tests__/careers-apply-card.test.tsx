import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ApplyCard } from "../app/(careers)/careers/_components/apply-card";

const profile = { fullName: "Mylene Santos", phone: "0917 220 4418", location: "", summary: "", skills: "", education: [], workHistory: [] };
const ready = (overrides: Partial<Parameters<typeof ApplyCard>[0]> = {}) =>
  renderToStaticMarkup(
    <ApplyCard
      jobPostingId="job-1"
      title="Packaging Associate"
      requiredDocuments={["Résumé", "Health certificate"]}
      access={{ kind: "ready", email: "mylene@example.com", profile, documents: [{ id: 1, name: "Resume.pdf" }] }}
      {...overrides}
    />,
  );

describe("Apply card", () => {
  test("shows the Applicant's profile summary with an Edit link", () => {
    const markup = ready();
    expect(markup).toContain("Apply with your profile");
    expect(markup).toContain("Mylene Santos");
    expect(markup).toContain("MS");
    expect(markup).toContain("mylene@example.com");
    expect(markup).toContain("0917 220 4418");
    expect(markup).toContain('href="/careers/profile"');
  });

  test("asks for each required Document of the Job Posting", () => {
    const markup = ready();
    expect(markup).toContain("Résumé");
    expect(markup).toContain("Health certificate");
    expect(markup.match(/name="documentId"/g)).toHaveLength(2);
    expect(markup).toContain("Resume.pdf");
  });

  test("submits with the Job Posting id and requires consent", () => {
    const markup = ready();
    expect(markup).toContain('name="jobPostingId" value="job-1"');
    expect(markup).toMatch(/<input(?=[^>]*name="privacyConsent")[^>]*required/);
    expect(markup).toContain("Submit application");
  });

  test("blocks submitting while required Documents are missing from the profile", () => {
    const markup = ready({ access: { kind: "ready", email: "a@b.c", profile, documents: [] } });
    expect(markup).toContain("Upload the required Documents");
    expect(markup).toMatch(/<button[^>]*disabled/);
  });

  test("omits the Documents section when the Job Posting requires none", () => {
    const markup = ready({ requiredDocuments: [] });
    expect(markup).not.toContain("documentId");
  });

  test("asks signed-out visitors to sign in instead of showing the form", () => {
    const markup = ready({ access: { kind: "signed-out" } });
    expect(markup).toContain('href="/careers/signin"');
    expect(markup).toContain("Sign in to apply");
    expect(markup).not.toContain("<form");
  });

  test("sends unverified or profile-less Applicants to finish the step first", () => {
    const unverified = ready({ access: { kind: "unverified" } });
    expect(unverified).toContain('href="/careers/verify-email"');
    const noProfile = ready({ access: { kind: "no-profile" } });
    expect(noProfile).toContain('href="/careers/complete-profile"');
    expect(noProfile).not.toContain("<form");
  });
});
