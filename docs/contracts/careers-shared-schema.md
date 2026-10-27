# Shared Careers / HRMS schema

Careers is the sole schema and migration owner of the shared `brenraphaels-ats`
Neon database. The source is `lib/careers/schema.ts`; the migration history is
`drizzle-careers/`. HRMS reads and writes these tables but must not generate,
push or run migrations against this database. Request schema changes in Careers.
Careers owns Applicant and Application writes; HRMS owns Job Posting and Job
Template writes. The storefront database and its `drizzle/` history are separate.

This contract supports HRMS `PabloEcobag-alt/hrms#34` (Job Templates) and `#37`
(announcements), under Careers #169 / #170. Retiring Job Posting webhooks is a
separate ticket; the legacy webhook still exists during this transition.

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
