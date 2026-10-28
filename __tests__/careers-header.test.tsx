import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/(careers)/careers/actions", () => ({ signOutApplicantAction: async () => {} }));
vi.mock("@/lib/careers/auth", () => ({ careersSession: vi.fn() }));
vi.mock("@/lib/careers/inbox", () => ({ unreadApplicantInboxCount: async () => 0 }));

import { CareersHeader } from "../components/features/careers/careers-header";
import { careersSession } from "@/lib/careers/auth";

const sectionLinks = ["/careers#open-roles", "/careers#life", "/careers#how-hiring-works"];

async function render(applicant: { fullName: string; email: string } | null) {
  vi.mocked(careersSession).mockResolvedValue(applicant as never);
  return renderToStaticMarkup(await CareersHeader());
}

describe("Careers header", () => {
  test("a guest sees the section links, Sign in and Become an applicant", async () => {
    const markup = await render(null);
    for (const href of sectionLinks) expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain('href="/careers/signin"');
    expect(markup).toContain("Become an applicant");
    expect(markup).not.toContain("My applications");
  });

  test("an Applicant sees the same section links, My applications, the bell and the profile menu", async () => {
    const markup = await render({ fullName: "Mylene Santos", email: "m@example.com" });
    for (const href of sectionLinks) expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain("My applications");
    expect(markup).toContain('href="/careers/notifications"');
    expect(markup).toContain("MS");
    expect(markup).toContain("Mylene");
    expect(markup).toContain('href="/careers/profile"');
    expect(markup).not.toContain('href="/careers/signin"');
  });
});
