import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { JobDetailBody, JobDetailHeader, requirementItems } from "../app/(careers)/careers/_components/job-detail";
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
  responsibilities: [],
  benefits: [],
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

describe("Job detail hero", () => {
  test("shows the department and city as the eyebrow", () => {
    expect(renderToStaticMarkup(<JobDetailHeader posting={posting()} />)).toContain("Operations · Quezon City");
  });

  test("shows tagline, openings and Posted date when present", () => {
    const markup = renderToStaticMarkup(
      <JobDetailHeader posting={posting({ tagline: "Pack with us.", openings: 2, postedAt: new Date("2026-10-20T00:00:00Z") })} />,
    );
    for (const text of ["Pack with us.", "2 openings", "Posted 20 Oct", "Share role"]) expect(markup).toContain(text);
  });

  test("hides tagline, openings and Posted date when there is no data", () => {
    const markup = renderToStaticMarkup(<JobDetailHeader posting={posting()} />);
    expect(markup).not.toContain("opening");
    expect(markup).not.toContain("Posted");
    expect(markup).toContain("Share role");
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

  test("skips the label line HRMS saves in front of Qualifications", () => {
    // Exactly what HRMS saves for a posting with only Qualifications filled in (joinRequirements in the HRMS repo).
    const items = requirementItems("Qualifications:\nAt least high school graduate\nAvailable Monday to Saturday");
    expect(items).toEqual(["At least high school graduate", "Available Monday to Saturday"]);
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ requirements: "Qualifications:\nAt least high school graduate\nAvailable Monday to Saturday" })} />);
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup).not.toContain("Qualifications:");
  });

  test("skips both headings of the older form, which saved Responsibilities and Qualifications together", () => {
    const saved = "Responsibilities:\nPack jars\nPrint labels\n\nQualifications:\nAt least high school graduate";
    expect(requirementItems(saved)).toEqual(["Pack jars", "Print labels", "At least high school graduate"]);
  });

  test("ignores case and surrounding spaces when matching a label line", () => {
    expect(requirementItems("  QUALIFICATIONS:  \nresponsibilities:\n\tA\n")).toEqual(["A"]);
  });

  test("keeps a line that merely contains the word, and a label without its colon", () => {
    const lines = ["Qualifications: a degree", "Relevant qualifications are a plus", "Qualifications", "Responsibilities: none", "- Qualifications:"];
    expect(requirementItems(lines.join("\n"))).toEqual(["Qualifications: a degree", "Relevant qualifications are a plus", "Qualifications", "Responsibilities: none", "Qualifications:"]);
  });

  test("still shows nothing when only a label was saved", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ requirements: "Qualifications:" })} />);
    expect(markup).not.toContain("looking for");
  });

  test("hides What we're looking for when requirements are empty", () => {
    for (const requirements of ["", "  \n "]) {
      const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ requirements })} />);
      expect(markup).not.toContain("looking for");
      expect(markup).toContain("About the role");
    }
  });

  test("What you'll do and What you'll get list their items between and after the other sections", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting({ responsibilities: ["Pack and seal jars", "Print labels"], benefits: ["Hourly pay plus overtime"] })} />);
    for (const text of ["What you’ll do", "Pack and seal jars", "Print labels", "What you’ll get", "Hourly pay plus overtime"]) {
      expect(markup).toContain(text);
    }
    const order = ["About the role", "What you’ll do", "What we’re looking for", "What you’ll get"].map((h) => markup.indexOf(h));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  test("hides each of the new sections when it has no items", () => {
    const markup = renderToStaticMarkup(<JobDetailBody posting={posting()} />);
    expect(markup).not.toContain("What you’ll do");
    expect(markup).not.toContain("What you’ll get");
    expect(markup).toContain("What we’re looking for");
  });

  test("a posting without the new fields still renders", () => {
    const legacy = { ...posting(), responsibilities: undefined, benefits: undefined } as unknown as JobPosting;
    const markup = renderToStaticMarkup(<JobDetailBody posting={legacy} />);
    expect(markup).toContain("About the role");
    expect(markup).not.toContain("What you’ll do");
  });
});
