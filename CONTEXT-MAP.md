# Context Map

## Contexts

- [Storefront](./CONTEXT.md): where people become Customers, browse Products, and place and pay for Orders
- [Careers](./app/(careers)/CONTEXT.md): where people become Applicants, browse Job Postings, and submit and track job Applications

## Relationships

- **Storefront ↔ Careers**: share no data, accounts, or vocabulary. Both live in this one app and follow the same visual design system, but a Customer and an Applicant are unrelated identities — even for the same person, signing up for one does not create or touch the other. See [ADR-0006](./docs/adr/0006-applicant-identity-lives-on-its-own-neon-project.md).
- **Careers ↔ HRMS (HR-ATS)**: HR-ATS is the Recruitment and Hiring Module of the separate HRMS application. Both use the shared `brenraphaels-ats` database. Careers owns its schema and migrations, Applicant identity, profiles and Application writes; HRMS writes Job Postings and Job Templates directly into the shared tables Careers reads and owns the hiring workflow. Job Posting webhooks are retired. Application submission and withdrawal still use the outbound queue; Application-status changes still return through the signed webhook. See [ADR-0009](./docs/adr/0009-hrms-writes-job-postings-to-the-shared-careers-database.md), which supersedes the Job Posting part of [ADR-0005](./docs/adr/0005-careers-and-hr-ats-integrate-over-api-webhook.md), and the [shared schema contract](./docs/contracts/careers-shared-schema.md).
