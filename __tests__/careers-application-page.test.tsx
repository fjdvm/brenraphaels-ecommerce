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

const fullOffer = { monthlyPay: 21500, startDate: new Date("2026-12-01T00:00:00Z"), schedule: "Tue–Sun · 7 AM – 4 PM", replyBy: new Date("2026-11-20T00:00:00Z"), letterName: "Letter-A.pdf" };

describe("Offer card", () => {
  test("shows every term it is given and the reply-by date", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer jobTitle="Production Assistant" offer={fullOffer} />);
    for (const text of ["love to have you on the team", "Production Assistant", "Monthly pay", "₱21,500", "1 Dec 2026", "Tue–Sun · 7 AM – 4 PM", "20 Nov 2026", "Letter-A.pdf"]) expect(markup).toContain(text);
    expect(markup).not.toContain("To be confirmed");
  });

  test("a partial Offer shows only what is known and the rest as To be confirmed", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer jobTitle="Production Assistant" offer={{ monthlyPay: 21500 }} />);
    expect(markup).toContain("₱21,500");
    expect(markup.match(/To be confirmed/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test("with no Offer data nothing is invented", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer jobTitle={null} offer={null} />);
    expect(markup).toContain("To be confirmed");
    expect(markup.replace(/<[^>]*>/g, " ")).not.toMatch(/₱|\b20\d\d\b/);
  });

  test("Accept offer, Decline and View are disabled with a coming-soon note", () => {
    const markup = renderToStaticMarkup(<ApplicationOffer jobTitle="X" offer={fullOffer} />);
    for (const label of ["Accept offer", "Decline", "View"]) expect(markup).toMatch(new RegExp(`<button[^>]*disabled[^>]*>\\s*${label}`));
    expect(markup).toContain("coming soon");
  });
});

describe("Documents to submit", () => {
  const required = [
    { name: "Résumé", hint: "Sent with your application", status: "Submitted" as const },
    { name: "NBI clearance", hint: "Not older than 6 months", status: "In review" as const },
    { name: "Health certificate", hint: null, status: "To upload" as const },
    { name: "SSS number", status: "To upload" as const },
  ];

  test("lists each required Document with status, hint and progress", () => {
    const markup = renderToStaticMarkup(<ApplicationDocuments documents={[]} required={required} />);
    for (const text of ["Documents to submit", "2 of 4", "Résumé", "Submitted", "In review", "Not older than 6 months", "Health certificate"]) expect(markup).toContain(text);
  });

  test("each Document still to upload has its own Upload button, and the copy names the allowed formats", () => {
    const markup = renderToStaticMarkup(<ApplicationDocuments documents={[]} required={required} />);
    expect(markup.match(/<button/g)).toHaveLength(2);
    expect(markup).not.toMatch(/<button[^>]*disabled/);
    expect(markup).toContain("PDF, JPG or PNG, up to 10 MB each.");
    expect(markup).not.toContain("coming soon");
  });

  test("with no required list it shows the submitted Documents as Submitted, read-only", () => {
    const markup = renderToStaticMarkup(<ApplicationDocuments documents={[{ id: 1, name: "Resume.pdf", contentType: "application/pdf", size: 254000, requiredFor: "Resume" }]} />);
    for (const text of ["Resume.pdf", "Submitted", "1 of 1"]) expect(markup).toContain(text);
    expect(markup).not.toContain("<button");
  });

  test("is hidden when there is nothing to show", () => {
    expect(renderToStaticMarkup(<ApplicationDocuments documents={[]} />)).toBe("");
  });
});
