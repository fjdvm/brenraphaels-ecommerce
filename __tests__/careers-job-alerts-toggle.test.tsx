import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ setApplicantJobAlerts: vi.fn() }));

import { JobAlertsToggle } from "@/app/(careers)/careers/(portal)/profile/job-alerts-toggle";

it("renders an accessible switch reflecting the stored choice", () => {
  const off = renderToStaticMarkup(<JobAlertsToggle initial={false} profileSaved />);
  expect(off).toContain('role="switch"');
  expect(off).toContain('aria-checked="false"');
  expect(off).toContain("Job-alert emails are off.");
  expect(off).toContain('aria-labelledby="job-alerts-label"');
  expect(off).not.toContain('disabled=""');
  const on = renderToStaticMarkup(<JobAlertsToggle initial profileSaved />);
  expect(on).toContain('aria-checked="true"');
  expect(on).toContain("Job-alert emails are on.");
});

it("is disabled until the Applicant profile is saved", () => {
  expect(renderToStaticMarkup(<JobAlertsToggle initial={false} profileSaved={false} />)).toContain('disabled=""');
});
