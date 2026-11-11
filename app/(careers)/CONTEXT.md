# Careers

Where people apply for a job at Bren Raphael's. This context covers how people become Applicants, prove they own their email, build an Applicant profile, browse open Job Postings, and submit, track, and withdraw job Applications. It lives inside this same app (see [Context Map](../../CONTEXT-MAP.md)) but shares no data, accounts, or vocabulary with the Storefront context — a Customer and an Applicant are unrelated identities, even for the same person, and each has its own dedicated Neon project and Neon Auth instance (see [ADR-0006](../../docs/adr/0006-applicant-identity-lives-on-its-own-neon-project.md)).

HR-ATS is the Recruitment and Hiring Module of HRMS, a separate application that owns Job Postings and the Application lifecycle from submission onward. Careers owns Applicant identity, profiles and submissions. See [ADR-0009](../../docs/adr/0009-hrms-writes-job-postings-to-the-shared-careers-database.md) for the shared-database relationship and [ADR-0005](../../docs/adr/0005-careers-and-hr-ats-integrate-over-api-webhook.md) for Application delivery and status updates.

## Language

**Applicant**:
A person applying for a job, identified by their email address. Unrelated to Customer, even for the same person.
_Avoid_: User, candidate, account

**Verified** (Applicant):
An Applicant whose email address is proven to be theirs by confirming a message sent to it. Required before applying; not required to browse Job Postings.
_Avoid_: Confirmed, activated

**Applicant profile**:
An Applicant's standing personal info, education, work history, skills, and Documents, built up over time and reused across Applications. Must be complete, along with a Job Posting's required Documents, before an Application can be submitted.
_Avoid_: Resume, CV (a resume is one Document within the profile, not the profile itself)

**Location** (Applicant profile):
The city and province an Applicant says they are from, chosen from the list of Philippine cities rather than typed. Distinct from a Job Posting's location, which HRMS writes and which Applicants can only filter by.
_Avoid_: Address, hometown

**Document**:
A file — resume, transcript, government ID, or whatever a Job Posting requires — an Applicant attaches to their profile, kept in the company's file-storage service.
_Avoid_: Attachment, upload

**Job Posting**:
A role authored and owned by HRMS. May be Draft, Open, Closed or Filled; only Open roles whose deadline has not passed are available to Applicants. Carries the required Documents and screening criteria an Applicant must satisfy to apply.
_Avoid_: Job, listing, vacancy

**Application**:
An Applicant's submission for one Job Posting: a snapshot of their profile, taken at submission, plus a Reference number. Only one Application per Applicant per Job Posting is allowed.
_Avoid_: Submission (as a noun for the record), candidacy

**Reference number**:
The identifier this app assigns an Application the instant it's submitted, sent in the confirmation email and adopted by HR-ATS as that record's own identifier. Permanent — HR-ATS never replaces it with an identifier of its own.
_Avoid_: Tracking number, application ID

**Frozen** (Application):
The point where an Application's profile snapshot stops following the Applicant's live profile — triggered by HR-ATS marking any Application status past `Received`, or the Job Posting's deadline passing, whichever happens first. Both the Application's creation and last-edit timestamps are recorded. Before this point, editing the profile updates the Application; after it, edits only affect future Applications.
_Avoid_: Locked, finalized

**Application status**:
Where an Application stands in HR-ATS's workflow — from `Received` through screening, exams, interviews, evaluation, offers, and hiring — mirrored here read-only via webhook. This app has no UI for acting on any status past `Received`, only for displaying it.
_Avoid_: Application state

**Interview** (Application):
An invitation HR-ATS may attach to an Application at the Interview status: when, where (online or in person), meeting link or address, and interviewer. Careers only displays it; any value HR-ATS hasn't supplied reads "To be confirmed".
_Avoid_: Meeting, appointment

**Withdraw**:
An Applicant ending their own Application before it reaches a final status (`Hired`, offer `Declined`/`Expired`, or `Rejected`). Allowed at any point — unlike editing the profile snapshot, which stops once the Application is Frozen.
_Avoid_: Cancel, retract

**Offer**:
The job offer HR-ATS makes for an Application, with monthly pay, a start date, a schedule, a reply-by date and an offer letter. Any term HR-ATS has not provided yet is shown as "To be confirmed", never invented. Accept offer and Decline (with an optional reason) are built but switched off by the `CAREERS_OFFER_REPLIES_ENABLED` flag until HR-ATS provides the endpoints; while it is off they are visible, disabled, and say "Coming soon. We'll email you the details." Replies go through the offer-reply gateway (`lib/careers/offer-reply.ts`), which has only a stub for now.
_Avoid_: Contract, job offer letter (the letter is one part of the Offer)
