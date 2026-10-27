# HRMS writes Job Postings directly into the shared Careers database

Careers and HRMS (whose Recruitment and Hiring Module is HR-ATS) share the `brenraphaels-ats` Neon database. HRMS writes Job Postings and Job Templates directly into the tables Careers reads. Careers is the sole owner of the shared schema and migrations; HRMS must request schema changes here and never run its own migrations against it. Careers owns Applicant and Application writes. This follows [HRMS ADR-0001](https://github.com/PabloEcobag-alt/hrms/blob/main/docs/adr/0001-hrms-and-careers-share-one-database.md) and the decisions in #169.

This supersedes only the Job Posting integration and separate-database assumption in [ADR-0005](./0005-careers-and-hr-ats-integrate-over-api-webhook.md). One source of truth removes the webhook-fed second copy and makes published, edited and closed Job Postings visible immediately. We accept coordinated schema changes and a shared database failure boundary in exchange for simpler integration. The HR-ATS webhook rejects Job Posting events without applying them; Application-status handling and the durable outbound submission/withdrawal queue are unchanged.

## Consequences

- Careers and HRMS both depend on the shared database being available. Schema changes must consider both applications; see the [shared schema contract](../contracts/careers-shared-schema.md).
- Careers shows only Open Job Postings with a future deadline; Draft, Closed, Filled and expired postings remain hidden.
- HRMS owns announcing new Open Job Postings to Applicants. Applicant identity remains unrelated to Customer identity, and [ADR-0006](./0006-applicant-identity-lives-on-its-own-neon-project.md) still holds.
- The development seed script continues to write Job Postings directly into the shared table; no webhook or schema migration is required for this retirement.
