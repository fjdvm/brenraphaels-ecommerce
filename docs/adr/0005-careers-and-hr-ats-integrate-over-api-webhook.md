# Careers and HR-ATS integrate over API/webhook, with HR-ATS as source of truth from submission onward

HR-ATS is a separate application with its own database, owning the full hiring workflow (requisition, posting, screening, exams, interviews, evaluation, offers, hiring). This app's Careers context only captures the Applicant's account, profile, and the moment of submission — everything from screening onward is HR-ATS's own domain, with no interactive UI for it here. Unlike the Storefront ↔ CREOMS boundary (ADR-0003), where this app owns the tracked data and the external system is downstream, here the external system (HR-ATS) is the one that owns the thing being tracked once it exists.

We chose a local-first, asynchronous integration rather than sending everything to HR-ATS synchronously in real time:

- **Job Postings** are synced into this app's own database via webhook from HR-ATS, not fetched live on each page load, so the public careers page keeps working through an HR-ATS outage.
- **Submitting** an Application is recorded in this app immediately — including its Documents, already stored in this app's own file storage — and delivered to HR-ATS through a durable, retrying queue rather than a blocking synchronous call. This app mints the Application's Reference number at submission time; HR-ATS adopts that number as the record's own identifier rather than minting a competing one.
- **Withdrawing** an Application follows the same local-first, queued-delivery pattern as submitting.
- **Application status** changes (screening through hiring) flow back into this app via webhook from HR-ATS, updating a local read-model the Applicant's dashboard renders from.
- If delivery to HR-ATS is delayed or fails, that stays invisible to the Applicant — their confirmation email already went out — and is surfaced only through internal logs/alerts on stuck queue items.
- Confirmation email ownership is split by who owns the moment: this app sends the "Application received" confirmation itself (via Brevo, same pattern as ADR-0002), since it's the one that knows the submission happened before HR-ATS has acknowledged it. HR-ATS sends every email from screening onward directly to the Applicant, using the same Brevo credentials and template/design system so all applicant-facing email looks and feels consistent regardless of which system sent it.

## Consequences

- A cross-database view spanning Careers and HR-ATS (e.g. "which Applicants are mid-interview") isn't possible in SQL; it has to be assembled by one side calling the other's API.
- HR-ATS's own internal record-keeping is never exposed to the Applicant — only this app's Reference number is, everywhere, permanently.
- Duplicate-Application checks and Application-status display both depend on this app's local copy of the data staying in sync with HR-ATS via webhook; a missed or delayed webhook delivery means the dashboard can be briefly stale, not wrong forever, but there is no reconciliation mechanism beyond HR-ATS's own retry/redelivery of the webhook.
- Sharing one set of Brevo credentials across two separate codebases means a key rotation or leak affects sending for both systems at once; this needs a shared secrets-management convention once the integration is actually wired up.
- Applicant Documents live in this app's own file storage for now, with only a reference sent to HR-ATS; moving to a shared file-storage service both systems read from directly is a real, but deliberately deferred, follow-up.
