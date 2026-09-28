"use client";

import { useActionState, useState } from "react";

import { submitApplicationAction } from "./actions";
import type { ApplicantProfile } from "@/lib/careers/profile";

type Document = { id: number; name: string };

export function ApplicationForm({ jobPostingId, title, profile, requiredDocuments, documents }: { jobPostingId: string; title: string; profile: ApplicantProfile; requiredDocuments: string[]; documents: Document[] }) {
  const [state, action, pending] = useActionState(submitApplicationAction, {});
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(() => requiredDocuments.map(() => ""));
  if (state.referenceNumber) return <section className="mt-8 border border-primary bg-surface-card p-6"><h2 className="font-serif text-3xl text-primary">Application received</h2><p className="mt-3 text-on-surface-variant">Your permanent Reference number is <strong>{state.referenceNumber}</strong>. {state.message ?? "We&apos;ve sent a confirmation email."}</p></section>;

  return <form action={action} className="mt-8 grid gap-6 border border-outline-variant bg-surface-card p-6">
    <input type="hidden" name="jobPostingId" value={jobPostingId} />
    <div><h2 className="font-serif text-2xl text-primary">Review your Application</h2><p className="mt-2 text-on-surface-variant">You are applying for {title}. Your current Applicant profile and selected Documents will be saved as a snapshot when you submit.</p></div>
    <section className="border border-outline-variant p-4 text-sm text-on-surface"><h3 className="font-semibold">Applicant profile</h3><dl className="mt-2 grid gap-1"><div><dt className="inline font-medium">Name: </dt><dd className="inline">{profile.fullName}</dd></div>{profile.phone ? <div><dt className="inline font-medium">Phone: </dt><dd className="inline">{profile.phone}</dd></div> : null}{profile.location ? <div><dt className="inline font-medium">Location: </dt><dd className="inline">{profile.location}</dd></div> : null}{profile.skills ? <div><dt className="inline font-medium">Skills: </dt><dd className="inline">{profile.skills}</dd></div> : null}{profile.summary ? <div><dt className="inline font-medium">Summary: </dt><dd className="inline">{profile.summary}</dd></div> : null}<div><dt className="inline font-medium">Education entries: </dt><dd className="inline">{profile.education.length}</dd></div><div><dt className="inline font-medium">Work-history entries: </dt><dd className="inline">{profile.workHistory.length}</dd></div></dl></section>
    <fieldset className="grid gap-4"><legend className="font-semibold text-on-surface">Required Documents</legend>{requiredDocuments.map((requiredDocument, index) => <label key={`${requiredDocument}-${index}`} className="grid gap-1 text-sm text-on-surface"><span>{requiredDocument}</span><select required name="documentId" defaultValue="" onChange={(event) => setSelectedDocumentIds((current) => current.map((id, itemIndex) => itemIndex === index ? event.target.value : id))} className="border border-outline-variant bg-surface px-3 py-2"><option value="" disabled>Select a Document</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>)}</fieldset>
    {selectedDocumentIds.some(Boolean) ? <section className="border border-outline-variant p-4 text-sm text-on-surface"><h3 className="font-semibold">Selected Documents</h3><ul className="mt-2 list-disc pl-5">{requiredDocuments.map((requiredDocument, index) => { const document = documents.find((item) => item.id === Number(selectedDocumentIds[index])); return document ? <li key={`${requiredDocument}-${document.id}`}>{requiredDocument}: {document.name}</li> : null; })}</ul></section> : null}
    {requiredDocuments.length > 0 && documents.length === 0 ? <p className="text-sm text-error">Upload the required Documents on your Applicant profile before submitting.</p> : null}
    <label className="flex gap-3 text-sm text-on-surface"><input required name="privacyConsent" value="yes" type="checkbox" /> <span>I consent to Bren Raphael&apos;s using my profile and selected Documents to process this Application.</span></label>
    {state.message ? <p role="alert" className="text-sm text-error">{state.message}</p> : null}
    <button disabled={pending || (requiredDocuments.length > 0 && documents.length === 0)} className="justify-self-start bg-primary px-5 py-3 font-semibold text-on-primary">{pending ? "Submitting…" : "Submit Application"}</button>
  </form>;
}
