# Context Map

## Contexts

- [Storefront](./CONTEXT.md): where people become Customers, browse Products, and place and pay for Orders
- [Careers](./app/(careers)/CONTEXT.md): where people become Applicants, browse Job Postings, and submit and track job Applications

## Relationships

- **Storefront ↔ Careers**: share no data, accounts, or vocabulary. Both live in this one app and follow the same visual design system, but a Customer and an Applicant are unrelated identities — even for the same person, signing up for one does not create or touch the other. See [ADR-0006](./docs/adr/0006-applicant-identity-lives-on-its-own-neon-project.md).
- **Careers → HR-ATS**: HR-ATS (the company's Applicant Tracking System) is a separate application with its own database, owning Job Postings and the Application lifecycle from the moment an Application is submitted onward. Careers owns the Applicant's account, profile, and the act of submitting. The two integrate over API/webhook, not a shared database — the same integration shape as Storefront ↔ CREOMS, but with source-of-truth reversed. See [ADR-0005](./docs/adr/0005-careers-and-hr-ats-integrate-over-api-webhook.md).
