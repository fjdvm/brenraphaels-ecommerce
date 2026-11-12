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
import { applicationProgress } from "../lib/careers/application-progress";
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

  test("shows the map link of an in-person interview, and none for an online one", () => {
    const inPerson = renderToStaticMarkup(<ApplicationInterview interview={{ mode: "in-person", address: "12 Kitchen St", mapLink: "https://maps.example/k" }} />);
    expect(inPerson).toContain("Map link");
    expect(inPerson).toContain("maps.example/k");
    expect(renderToStaticMarkup(<ApplicationInterview interview={{ mode: "online", meetingLink: "https://meet.example.test/a" }} />)).not.toContain("Map link");
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

import { offerPresentation, type ApplicationOffer as OfferRecord } from "../lib/careers/application-offer";

const offer = (overrides: Partial<OfferRecord> = {}): OfferRecord => ({
  id: 7, status: "Sent", monthlyPay: 21500, startDate: "2026-12-01", employmentType: "Full-time", schedule: "Tue–Sun · 7 AM – 4 PM",
  probation: "6 months", reportsTo: "Paolo Garcia", branch: "Cainta branch", sentAt: new Date("2026-11-05T02:00:00Z"),
  replyBy: "2026-11-20", repliedAt: null, ...overrides,
});
const markupOf = (view: "reply" | "accepted" | "declined" | "hired", record: OfferRecord, extra: Partial<Parameters<typeof ApplicationOffer>[0]> = {}) =>
  renderToStaticMarkup(<ApplicationOffer view={view} jobTitle="Production Assistant" offer={record} referenceNumber="BR-APP-1" today="2026-11-10" {...extra} />);

describe("Offer card", () => {
  test("a Sent Offer shows the complete terms and the reply-by date, with no offer letter row", () => {
    const markup = markupOf("reply", offer());
    for (const text of ["love to have you on the team", "Production Assistant", "Monthly pay", "₱21,500", "Start date", "1 Dec 2026", "Employment type", "Full-time", "Schedule", "Tue–Sun · 7 AM – 4 PM", "Probation", "6 months", "Reports to", "Paolo Garcia", "Branch", "Cainta branch", "Please reply by 20 Nov 2026"]) {
      expect(markup).toContain(text);
    }
    for (const gone of ["Offer letter", "View</button>", "To be confirmed"]) expect(markup).not.toContain(gone);
  });

  test("a Sent Offer past its reply-by date is flagged, and still can be replied to", () => {
    const late = markupOf("reply", offer({ replyBy: "2026-11-05" }), { repliesEnabled: true });
    expect(late).toContain("has passed");
    expect(late).toContain("You can still reply");
    expect(late).toMatch(/<button[^>]*>\s*Accept offer/);
    expect(late).not.toMatch(/<button[^>]*disabled=""[^>]*>\s*Accept offer/);
    expect(markupOf("reply", offer({ replyBy: "2026-11-10" }), { repliesEnabled: true })).not.toContain("has passed");
  });

  test("with the flag off, Accept offer and Decline are disabled with the Coming soon note", () => {
    const markup = markupOf("reply", offer());
    for (const label of ["Accept offer", "Decline"]) expect(markup).toMatch(new RegExp(`<button[^>]*disabled[^>]*>\\s*${label}`));
    expect(markup).toContain("Coming soon. We&#x27;ll email you the details.");
  });

  test("with the flag on, Accept offer and Decline are enabled and the note is gone", () => {
    const markup = markupOf("reply", offer(), { repliesEnabled: true });
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>\s*(Accept offer|Decline)/);
    expect(markup).not.toContain("Coming soon");
  });

  test("an Accepted Offer says when it was accepted, shows the terms and has no reply buttons", () => {
    const markup = markupOf("accepted", offer({ status: "Accepted", repliedAt: new Date("2026-11-08T05:00:00Z") }), { repliesEnabled: true });
    for (const text of ["You accepted your offer", "You accepted on 8 Nov 2026", "₱21,500", "Paolo Garcia"]) expect(markup).toContain(text);
    expect(markup).not.toContain("Accept offer");
    expect(markup).not.toContain("<button");
  });

  test("a Declined Offer says when it was declined, shows the terms and cannot be acted on", () => {
    const markup = markupOf("declined", offer({ status: "Declined", repliedAt: new Date("2026-11-08T05:00:00Z") }), { repliesEnabled: true });
    for (const text of ["You declined this offer", "You declined on 8 Nov 2026", "₱21,500"]) expect(markup).toContain(text);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("Documents");
  });

  test("a Hired Applicant is welcomed aboard with the terms and nothing to do", () => {
    const markup = markupOf("hired", offer({ status: "Accepted" }));
    for (const text of ["Welcome aboard", "joining Bren Raphael", "Production Assistant", "₱21,500"]) expect(markup).toContain(text);
    expect(markup).not.toContain("<button");
  });

  test("a missing reply time still reads sensibly", () => {
    expect(markupOf("accepted", offer({ status: "Accepted", repliedAt: null }))).toContain("You accepted this offer");
  });
});

describe("What the Application page shows for an Offer", () => {
  test("a Draft (no Offer read) shows nothing, and no documents", () => {
    expect(offerPresentation("Offer", undefined)).toMatchObject({ view: null, showDocuments: false });
  });

  test("Sent and Accepted at the Offer stage show the card with the document checklist", () => {
    expect(offerPresentation("Offer", offer())).toEqual({ view: "reply", showDocuments: true, outcomeStatus: "Offer" });
    expect(offerPresentation("Offer", offer({ status: "Accepted" }))).toEqual({ view: "accepted", showDocuments: true, outcomeStatus: "Offer" });
  });

  test("Declined shows the card without the checklist, and the end state reads Offer declined", () => {
    expect(offerPresentation("Rejected", offer({ status: "Declined" }))).toEqual({ view: "declined", showDocuments: false, outcomeStatus: "Declined" });
  });

  test("Hired welcomes aboard with a read-only checklist; the stepper stays on Offer until then", () => {
    expect(offerPresentation("Hired", offer({ status: "Accepted" }))).toMatchObject({ view: "hired", showDocuments: true });
    expect(applicationProgress("Offer")).toMatchObject({ closed: false, step: 4 });
    expect(applicationProgress("Hired")).toMatchObject({ closed: false, step: 5 });
  });

  test("a withdrawn Application shows no Offer to act on", () => {
    for (const record of [offer(), offer({ status: "Accepted" }), offer({ status: "Declined" })]) expect(offerPresentation("Withdrawn", record).view).toBeNull();
  });

  test("an Offer is not shown before the Application reaches the Offer stage", () => {
    expect(offerPresentation("Interview", offer()).view).toBeNull();
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
