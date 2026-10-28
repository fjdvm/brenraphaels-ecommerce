import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { JobPostingsList, OpenRolesHeading } from "../app/(careers)/careers/_components/job-postings-list";
import type { JobPosting } from "../lib/careers/job-postings";

const posting = (overrides: Partial<JobPosting>): JobPosting => ({
  id: "job-1",
  title: "Packaging & Fulfillment Associate",
  department: "Operations",
  description: "",
  requirements: "",
  employmentType: "Part-time",
  location: "Quezon City, Philippines",
  deadline: new Date("2099-01-01"),
  requiredDocuments: [],
  screeningCriteria: [],
  ...overrides,
} as JobPosting);

describe("Open role cards", () => {
  test("each card shows title, department, location, employment type and a View & apply link", () => {
    const markup = renderToStaticMarkup(<JobPostingsList jobs={[posting({})]} />);
    for (const text of ["Packaging &amp; Fulfillment Associate", "Operations", "Quezon City, Philippines", "Part-time", "View &amp; apply"]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('href="/careers/job-1"');
  });

  test("renders one card per posting", () => {
    const markup = renderToStaticMarkup(
      <JobPostingsList jobs={[posting({ id: "a" }), posting({ id: "b", title: "Production Assistant" })]} />,
    );
    expect(markup.match(/<li /g)).toHaveLength(2);
  });

  test("shows an empty state with no roles", () => {
    const markup = renderToStaticMarkup(<JobPostingsList jobs={[]} />);
    expect(markup).not.toContain("<li ");
    expect(markup).toContain("There are no open Job Postings");
  });
});

describe("Open roles heading", () => {
  test("shows the design's heading and the role count", () => {
    const markup = renderToStaticMarkup(<OpenRolesHeading count={2} />);
    expect(markup).toContain("Open roles");
    expect(markup).toContain("Find your place in our kitchen");
    expect(markup).toContain("2 open roles");
  });

  test("uses the singular for one role and zero for none", () => {
    expect(renderToStaticMarkup(<OpenRolesHeading count={1} />)).toContain("1 open role<");
    expect(renderToStaticMarkup(<OpenRolesHeading count={0} />)).toContain("0 open roles");
  });
});
