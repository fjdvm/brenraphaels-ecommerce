import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ApplicationHeader } from "../app/(careers)/careers/_components/application-header";
import { ApplicationStepper } from "../app/(careers)/careers/_components/application-stepper";
import type { ApplicationSummary } from "../lib/careers/applications";

const application = (overrides: Partial<ApplicationSummary> = {}): ApplicationSummary => ({
  referenceNumber: "BR-APP-0412",
  status: "Interview",
  appliedAt: new Date("2026-10-18T00:00:00Z"),
  title: "Production Assistant",
  department: "Kitchen",
  location: "Quezon City, Philippines",
  employmentType: "Full-time",
  ...overrides,
});

describe("Application header", () => {
  test("shows the back link, title, status chip, applied date and Reference number", () => {
    const markup = renderToStaticMarkup(<ApplicationHeader application={application()} />);
    expect(markup).toContain('href="/careers/applications"');
    for (const text of ["Your applications", "<h1", "Production Assistant", "Interview", "Kitchen", "Applied 18 Oct 2026", "BR-APP-0412"]) {
      expect(markup).toContain(text);
    }
  });

  test("still renders when the Job Posting is gone", () => {
    const markup = renderToStaticMarkup(<ApplicationHeader application={application({ title: null, department: null, location: null, employmentType: null })} />);
    expect(markup).toContain("Job posting unavailable");
    expect(markup).toContain("BR-APP-0412");
  });
});

describe("Application stepper", () => {
  test("marks earlier steps done and the status's step current", () => {
    const markup = renderToStaticMarkup(<ApplicationStepper status="Interview" appliedOn="18 Oct 2026" />);
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="step"[^>]*>.*?Interview/);
    expect(markup).toContain("18 Oct 2026");
  });

  test("has no current step once the Application is closed", () => {
    expect(renderToStaticMarkup(<ApplicationStepper status="Rejected" appliedOn="18 Oct 2026" />)).not.toContain("aria-current");
  });
});
