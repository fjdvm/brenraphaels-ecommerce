import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ApplicationDocuments } from "../app/(careers)/careers/_components/application-documents";
import { ApplicationEndState } from "../app/(careers)/careers/_components/application-end-state";
import { ApplicationHelp, ApplicationMessages } from "../app/(careers)/careers/_components/application-side-panels";
import { ApplicationHeader } from "../app/(careers)/careers/_components/application-header";
import { ApplicationOffer } from "../app/(careers)/careers/_components/application-offer";
import { ApplicationStepper } from "../app/(careers)/careers/_components/application-stepper";
import { ApplicationInterview } from "../app/(careers)/careers/_components/application-interview";
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
    for (const text of ["Your applications", "<h1", "Production Assistant", "Interview scheduled", "Kitchen", "Applied 18 Oct 2026", "BR-APP-0412"]) {
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

  test("dates only the steps already known", () => {
    const markup = renderToStaticMarkup(<ApplicationStepper status="Interview" appliedOn="18 Oct" updatedOn="21 Oct" />);
    expect(markup).toContain("18 Oct");
    expect(markup).toContain("21 Oct");
    expect(renderToStaticMarkup(<ApplicationStepper status="Received" appliedOn="18 Oct" />)).not.toContain("21 Oct");
  });
});

describe("Closed Application", () => {
  test.each([
    ["Rejected", "Not selected"],
    ["Withdrawn", "Withdrawn"],
    ["Declined", "Offer declined"],
    ["Expired", "Offer expired"],
  ] as const)("%s shows its end state", (status, label) => {
    const markup = renderToStaticMarkup(<ApplicationEndState status={status} closedOn="21 Oct 2026" />);
    expect(markup).toContain(label);
    expect(markup).toContain("21 Oct 2026");
    expect(markup).not.toContain("aria-current");
  });
});

describe("Side panels", () => {
  test("Messages says there are none yet, and Questions? offers the hiring team", () => {
    const markup = renderToStaticMarkup(
      <>
        <ApplicationMessages />
        <ApplicationHelp />
      </>,
    );
    for (const text of ["Messages", "No messages yet", "Questions?", "Message the team"]) expect(markup).toContain(text);
  });
});

describe("Interview stage", () => {
  test("shows the full invitation", () => {
    const markup = renderToStaticMarkup(
      <ApplicationInterview
        interview={{
          startsAt: new Date("2026-11-05T07:00:00Z"),
          endsAt: new Date("2026-11-05T07:30:00Z"),
          mode: "online",
          where: "Google Meet",
          meetingLink: "https://meet.example.test/abc",
          interviewer: "Pat Cruz · Head cook",
        }}
      />,
    );
    for (const text of ["You’re invited to an online interview", "Thursday, 5 Nov 2026", "3:00 – 3:30 PM", "Online · Google Meet", "meet.example.test/abc", "Pat Cruz · Head cook", "Before your interview"]) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain("To be confirmed");
  });

  test("shows an address for an in-person interview", () => {
    const markup = renderToStaticMarkup(<ApplicationInterview interview={{ mode: "in-person", address: "12 Kitchen St, Quezon City" }} />);
    expect(markup).toContain("invited to an in-person interview");
    expect(markup).toContain("12 Kitchen St, Quezon City");
  });

  test("an in-person interview with no venue reads To be confirmed for Where", () => {
    const markup = renderToStaticMarkup(<ApplicationInterview interview={{ mode: "in-person", address: "12 Kitchen St" }} />);
    expect(markup).toMatch(/Where<\/dt><dd[^>]*>To be confirmed/);
  });

  test("reads To be confirmed for every missing value, and for no interview at all", () => {
    for (const interview of [{ interviewer: "Pat Cruz" }, undefined]) {
      const markup = renderToStaticMarkup(<ApplicationInterview interview={interview} />);
      expect(markup).toContain("To be confirmed");
      expect(markup).toContain("You’re invited to an interview");
    }
    expect(renderToStaticMarkup(<ApplicationInterview interview={undefined} />).match(/To be confirmed/g)).toHaveLength(4);
  });

  test("its three actions are disabled with a coming-soon note", () => {
    const markup = renderToStaticMarkup(<ApplicationInterview interview={undefined} />);
    for (const label of ["Join interview", "Add to calendar", "Need to reschedule?"]) expect(markup).toContain(label);
    expect(markup.match(/<button[^>]*disabled/g)).toHaveLength(3);
    expect(markup).toContain("coming soon");
    expect(markup).not.toContain("<a ");
  });

  test("What you sent shows documents, applied date and the Applicant's answers", () => {
    const markup = renderToStaticMarkup(
      <ApplicationSubmission
        appliedAt={new Date("2026-10-18T00:00:00Z")}
        documents={[{ id: 1, name: "Resume.pdf", contentType: "application/pdf", size: 254000, requiredFor: "Resume" }]}
        profile={{ summary: "I love working in a kitchen.", skills: "Baking", location: "Quezon City" }}
      />,
    );
    for (const text of ["What you sent", "Submitted 18 Oct 2026", "Resume.pdf", "PDF · 248 KB · sent 18 Oct", "I love working in a kitchen.", "Baking"]) expect(markup).toContain(text);
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
