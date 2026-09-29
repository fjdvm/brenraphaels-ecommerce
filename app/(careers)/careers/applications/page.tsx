import Link from "next/link";

import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";

import { BackLink } from "../_components/back-link";
import { SubmitButton } from "../_components/submit-button";
import { withdrawApplicationAction } from "./actions";

export default async function ApplicationsPage() {
  const applicant = await requireApplicant();
  const applications = await createApplicationStore(getCareersDatabase()).listForApplicant(applicant.userId);
  return <section className="mx-auto max-w-3xl py-12"><BackLink href="/careers" className="text-sm underline">Back</BackLink><div className="mt-8 flex items-center justify-between gap-4"><div><h1 className="font-serif text-4xl text-primary">Your Applications</h1><p className="mt-2 text-on-surface-variant">Track every Application you have submitted.</p></div><Link href="/careers" className="font-semibold text-primary underline">Browse Job Postings</Link></div>{applications.length === 0 ? <p className="mt-8 border border-outline-variant p-6 text-on-surface-variant">You have not submitted an Application yet.</p> : <ul className="mt-8 grid gap-4">{applications.map((application) => <li key={application.referenceNumber} className="border border-outline-variant bg-surface-card p-5"><p className="font-semibold text-on-surface">Reference number: {application.referenceNumber}</p><p className="mt-1 text-on-surface-variant">Status: {application.status}</p>{canWithdrawApplication(application.status) ? <form action={withdrawApplicationAction} className="mt-4"><input type="hidden" name="referenceNumber" value={application.referenceNumber} /><SubmitButton pendingLabel="Withdrawing…" className="font-semibold text-primary underline">Withdraw Application</SubmitButton></form> : null}</li>)}</ul>}</section>;
}
