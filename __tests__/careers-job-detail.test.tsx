import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { JobDetailBody, JobDetailHeader } from "../app/(careers)/careers/_components/job-detail";
import type { JobPosting } from "../lib/careers/job-postings";

const posting = (overrides: Partial<JobPosting> = {}): JobPosting => ({
  id: "job-1",
  title: "Packaging & Fulfillment Associate",
  department: "Operations",
  description: "You'll help get our ube jam to customers.",
  requirements: "At least high school graduate\nAvailable Monday to Saturday",
  employmentType: "Part-time",
  location: "Quezon City, Philippines",
  deadline: new Date("2026-11-15T00:00:00Z"),
  requiredDocuments: [],
  screeningCriteria: [],
  ...overrides,
} as JobPosting);

describe("Job detail header", () => {
  test("shows the back link, title and a chip each for department, location, type and deadline", () => {
    const markup = renderToStaticMarkup(<JobDetailHeader posting={posting()} />);
    expect(markup).toContain('href="/careers"');
    expect(markup).toContain("All open roles");
    expect(markup).toContain("<h1");
    for (const text of ["Packaging &amp; Fulfillment Associate", "Operations", "Quezon City, Philippines", "Part-time", "Apply by 15 Nov 2026"]) {
      expect(markup).toContain(text);
    }
  });
});

describe("Job detail body", () => {
  test("About the role shows the description", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting()} />);
    expect(markup).toContain("About the role");
    expect(markup).toContain("You&#x27;ll help get our ube jam to customers.");
  });

  test("What we're looking for lists each requirement line", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting()} />);
    expect(markup).toContain("What we’re looking for");
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup).toContain("At least high school graduate");
  });

  test("strips bullet markers and blank lines from requirements", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ requirements: "- First\n\n• Second\n" })} />);
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup).not.toContain("- First");
    expect(markup).not.toContain("•");
  });

  test("hides What we're looking for when requirements are empty", () => {
    for (const requirements of ["", "  \n "]) {
      const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ requirements })} />);
      expect(markup).not.toContain("looking for");
      expect(markup).toContain("About the role");
    }
  });
});
