# Shared Careers / HRMS schema

Careers is the sole schema and migration owner of the shared `brenraphaels-ats`
Neon database. The source is `lib/careers/schema.ts`; the migration history is
`drizzle-careers/`. HRMS reads and writes these tables but must not generate,
push or run migrations against this database. Request schema changes in Careers.
Careers owns Applicant and Application writes; HRMS owns Job Posting and Job
Template writes. The storefront database and its `drizzle/` history are separate.

This contract supports HRMS `PabloEcobag-alt/hrms#34` (Job Templates) and `#37`
(announcements), under Careers #169 / #170. Job Posting webhooks are retired under #175; signed `job_posting.*` events
are rejected with HTTP 400 without writing. Only `application.status_changed`
is accepted by the HR-ATS webhook. See [ADR-0009](../adr/0009-hrms-writes-job-postings-to-the-shared-careers-database.md).

## Table shapes

Both tables are in `public`. SQL names below are authoritative; the Drizzle
properties use camelCase. All columns are NOT NULL unless marked nullable.

| SQL column | Type | `job_postings` | `job_templates` |
| --- | --- | --- | --- |
| `id` | text, primary key | HRMS supplies stable ID | HRMS supplies independent ID |
| `title` | text | Required | Required |
| `department` | text | Required | Required |
| `description` | text | Required | Required |
| `requirements` | text | Required | Required |
| `responsibilities` | jsonb | Array of strings, default `[]` | Array of strings, default `[]` |
| `benefits` | jsonb | Array of strings, default `[]` | Array of strings, default `[]` |
| `employment_type` | text | Required | Required |
| `location` | text | Required | Required |
| `deadline` | timestamptz | Required | No column |
| `required_documents` | jsonb | Array of strings | Array of strings |
| `screening_criteria` | jsonb | Array of strings | Array of strings |
| `status` | text | `draft`, `open`, `closed`, `filled` | Same vocabulary |
| `announced_at` | timestamptz, nullable | Default NULL | Default NULL |
| `updated_at` | timestamptz | Default `now()` | Default `now()` |

Status uses text, not a PostgreSQL enum; HRMS must validate the lowercase values.
HRMS must validate text and JSON arrays before writing and explicitly update
`updated_at` on edits (the default only applies on insert). The existing
`job_postings.deadline` NOT NULL constraint is unchanged by #170; supporting a
Draft with no deadline requires a coordinated schema change before HRMS writes
such rows. Careers only exposes `status = 'open' AND deadline > now()` in the
listing, detail lookup and filter options. Draft, Closed, Filled, expired and
exactly-at-deadline postings remain hidden.

A Job Template holds every Job Posting column except `deadline`, including the
metadata columns. Save it only on explicit Staff action. Starting a Job Posting
copies the content into a new independent row with a new ID, `status = 'draft'`
and `announced_at = NULL`; do not carry over the template's announcement marker.
There is no template foreign key: editing/deleting either row cannot change the
other. Careers provides no template UI or template write API.

## Announcement marker

`job_postings.announced_at` is NULL until HRMS records that Applicants were told
the Job Posting opened. Set it to the completion time after the announcement
work succeeds, and preserve it through edits, closing, filling and retries.
Existing rows receive NULL; this migration sends nothing and changes no content,
status or deadline. A historical NULL does not by itself instruct HRMS to
announce an already Open posting.

The timestamp records completion, not a retry queue or concurrency lock. HRMS
#37 must use stable per-posting/per-channel idempotency keys and retry failures
without failing publish; it must not infer exactly-once delivery from a NULL
check alone. The marker does not replace HRMS's publish Audit Event.

## Applying migrations

From the Careers checkout, load the target environment and run
`npm run careers:db:migrate` with `CAREERS_DATABASE_URL_UNPOOLED` set to that
branch's direct connection string. Never run `db:migrate` for this database;
that command targets the storefront. Test on an isolated branch first. HRMS
must wait until the Careers migration has been applied before using new columns.

## Applicant job-alert email preference

`public.applicant_profiles.job_alerts_opt_in` is a NOT NULL boolean, default
`false` for both existing and new Applicants (migration
`0005_applicant_job_alerts`). Careers owns this value. HRMS reads it when
selecting email recipients: send job-alert email only to Applicants whose email
is Verified **and** whose `job_alerts_opt_in` is `true`. The preference alone is
not proof of verification. In-app notifications do not depend on this flag.

Careers exposes `setApplicantJobAlerts({ jobAlertsOptIn: boolean })` as a profile
Server Action. It saves immediately for the signed-in Applicant, returns the
saved choice (or a retryable message), and never accepts a target Applicant id.
The profile store's `find` includes `jobAlertsOptIn`; ordinary profile saves
preserve the existing preference. This backend ticket does not add the profile
toggle UI.

## Responsibilities and Benefits

HRMS [#100](https://github.com/fjdvm/hrms/issues/100) adds optional lists of text
to both Job Postings and Job Templates. Omit either column to use its empty-array
default; NULL is not accepted. Existing rows receive empty lists while all
previous content, status, deadlines and timestamps remain unchanged. Careers
retains both columns in its schema declaration.
