import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ApplicationDocuments } from "../app/(careers)/careers/_components/application-documents";
import { ApplicationHeader } from "../app/(careers)/careers/_components/application-header";
import { ApplicationOffer } from "../app/(careers)/careers/_components/application-offer";
import { ApplicationStepper } from "../app/(careers)/careers/_components/application-stepper";
import { ApplicationStageDetails } from "../app/(careers)/careers/_components/application-stage-details";
import { ApplicationSubmission } from "../app/(careers)/careers/_components/application-submission";
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

describe("Interview stage", () => {
  test("shows stage details from the status and no actions or Messages", () => {
    const markup = renderToStaticMarkup(<ApplicationStageDetails status="Interview" updatedAt={new Date("2026-10-21T00:00:00Z")} />);
    expect(markup).toContain("Interview stage");
    expect(markup).toContain("21 Oct 2026");
    for (const hidden of ["Join", "Reschedule", "Messages", "<button"]) expect(markup).not.toContain(hidden);
  });

  test("What you sent shows documents, applied date and the Applicant's answers", () => {
    const markup = renderToStaticMarkup(
      <ApplicationSubmission
        appliedAt={new Date("2026-10-18T00:00:00Z")}
        documents={[{ id: 1, name: "Resume.pdf", contentType: "application/pdf", size: 254000, requiredFor: "Resume" }]}
        profile={{ summary: "I love working in a kitchen.", skills: "Baking", location: "Quezon City" }}
      />,
    );
    for (const text of ["What you sent", "Submitted 18 Oct 2026", "Resume.pdf", "248 KB", "I love working in a kitchen.", "Baking"]) expect(markup).toContain(text);
  });

  test("hides sections with no data", () => {
    const markup = renderToStaticMarkup(<ApplicationSubmission appliedAt={new Date("2026-10-18T00:00:00Z")} documents={[]} profile={{ summary: null, skills: "", location: null }} />);
    expect(markup).toContain("Submitted 18 Oct 2026");
    for (const hidden of ["Documents", "About you", "Skills", "Location"]) expect(markup).not.toContain(hidden);
  });
});

describe("Offer stage", () => {
  test("shows the offer status from existing data and no actions", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer status="Offer" updatedAt={new Date("2026-10-29T00:00:00Z")} jobTitle="Production Assistant" />);
    for (const text of ["love to have you on the team", "Production Assistant", "Offer", "29 Oct 2026"]) expect(markup).toContain(text);
    for (const hidden of ["Accept", "Decline", "<button", "Monthly pay", "Start date", "Messages"]) expect(markup).not.toContain(hidden);
  });

  test("copes with a missing Job Posting", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer status="Offer" updatedAt={new Date("2026-10-29T00:00:00Z")} jobTitle={null} />);
    expect(markup).toContain("Your offer is on its way.");
  });
});

describe("Offer stage documents", () => {
  test("lists the submitted documents by name, read-only", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDocuments
        documents={[
          { id: 1, name: "Resume.pdf", contentType: "application/pdf", size: 254000, requiredFor: "Resume" },
          { id: 2, name: "Valid_ID.png", contentType: "image/png", size: 90000, requiredFor: "Valid government ID" },
        ]}
      />,
    );
    for (const text of ["Resume.pdf", "Valid_ID.png", "Sent with your application", "Submitted"]) expect(markup).toContain(text);
    for (const hidden of ["<button", "<input", "Upload"]) expect(markup).not.toContain(hidden);
  });

  test("is hidden when there are no documents", () => {
    expect(renderToStaticMarkup(<ApplicationDocuments documents={[]} />)).toBe("");
  });
});
