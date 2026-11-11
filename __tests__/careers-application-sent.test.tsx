import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ApplicationSent } from "@/app/(careers)/careers/_components/application-sent";

const props = { firstName: "Jane", role: "Baker", referenceNumber: "BR-20261031-ABCD1234", sentAt: "2026-10-30T18:14:00Z" };

describe("ApplicationSent", () => {
  it("shows the role, Reference number, sent time and the four-step progress with Review current", () => {
    const html = renderToStaticMarkup(<ApplicationSent {...props} />);
    expect(html).toContain("Application sent!");
    expect(html).toContain("Thanks, Jane.");
    expect(html).toContain("BR-20261031-ABCD1234");
    expect(html).toContain("31 Oct 2026, 2:14 AM");
    for (const step of ["Apply", "Review", "Interview", "Welcome"]) expect(html).toContain(step);
    expect(html).not.toContain("Offer");
    expect(html).toMatch(/aria-current="step"[^>]*>.*?Review/);
  });

  it("links to track the application and browse roles", () => {
    const html = renderToStaticMarkup(<ApplicationSent {...props} />);
    expect(html).toContain('href="/careers/applications/BR-20261031-ABCD1234"');
    expect(html).toContain('href="/careers"');
  });

  it("only mentions the emailed copy when a confirmation was sent", () => {
    expect(renderToStaticMarkup(<ApplicationSent {...props} />)).not.toContain("We also sent a copy");
    expect(renderToStaticMarkup(<ApplicationSent {...props} emailedTo="jane@example.com" />)).toContain("We also sent a copy to jane@example.com");
  });
});
