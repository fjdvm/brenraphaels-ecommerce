"use client";

import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { submitApplicationAction } from "@/app/(careers)/careers/(portal)/[id]/apply/actions";
import { RequiredMark, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { profileStrength } from "@/app/(careers)/careers/(portal)/profile/profile-strength";
import { initialsOf } from "@/lib/customer/initials";
import type { ApplicantProfile } from "@/lib/careers/profile";

type Document = { id: number; name: string };

/** What the visitor can do from the card: apply, or the step they must finish first. */
export type ApplyAccess =
  | { kind: "signed-out" }
  | { kind: "unverified" }
  | { kind: "no-profile" }
  | { kind: "ready"; email: string; profile: ApplicantProfile; documents: Document[] };

const cardClass = "flex w-full shrink-0 scroll-mt-6 flex-col gap-5 rounded-[40px] border border-line bg-white px-6 pb-8 pt-9 sm:px-8 lg:w-[460px]";
const headingClass = "font-serif text-[22px] leading-[1.3] text-primary";
const labelClass = "flex gap-[3px] text-[13px] font-medium text-ink";
const linkClass = "text-sm font-medium text-primary";
const buttonClass = "flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-9 py-4 text-lg text-on-primary";

const nextStepLabel: Record<string, string> = {
  "Résumé uploaded": "Upload résumé",
  "Summary & skills": "Add summary & skills",
  Education: "Add education",
  "Work history": "Add work history",
};

function Gate({ title, message, href, label, requiredDocuments }: { title: string; message: string; href: string; label: string; requiredDocuments: string[] }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={headingClass}>{title}</h2>
        <p className="text-sm leading-[21px] text-body">{message}</p>
      </div>
      {requiredDocuments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-ink">Required Documents</p>
          <ul className="list-disc pl-5 text-sm text-body">{requiredDocuments.map((document) => <li key={document}>{document}</li>)}</ul>
        </div>
      )}
      <Link href={href} className={buttonClass}>{label}</Link>
    </>
  );
}

function Received({ referenceNumber, message }: { referenceNumber: string; message?: string }) {
  return (
    <div className="flex flex-col gap-1" role="status">
      <h2 className={headingClass}>Application received</h2>
      <p className="text-sm leading-[21px] text-body">
        Your permanent Reference number is <strong>{referenceNumber}</strong>. {message ?? "We’ve sent a confirmation email."}
      </p>
      <Link href="/careers/applications" className={`${linkClass} mt-2`}>Follow it in My applications</Link>
    </div>
  );
}

function ApplyForm({ jobPostingId, requiredDocuments, access }: { jobPostingId: string; requiredDocuments: string[]; access: Extract<ApplyAccess, { kind: "ready" }> }): ReactNode {
  const [state, action] = useActionState(submitApplicationAction, {});
  const { profile, email, documents } = access;
  if (state.referenceNumber) return <Received referenceNumber={state.referenceNumber} message={state.message} />;
  const missingDocuments = requiredDocuments.length > 0 && documents.length === 0;
  const contact = [email, profile.phone].filter(Boolean).join(" · ");
  const strength = profileStrength({ profile, documentCount: documents.length });
  const pending = strength.steps.find((step) => !step.done);
  const nextStep = pending ? nextStepLabel[pending.label] : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="jobPostingId" value={jobPostingId} />
      <div className="flex flex-col gap-1.5">
        <h2 className={headingClass}>Apply with your profile</h2>
        <p className="text-sm leading-normal text-body">We’ll send your saved profile and résumé. Check them before you submit.</p>
      </div>
      <div className="flex items-center gap-3.5 rounded-3xl bg-surface py-4 pl-4 pr-[18px]">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-on-primary">{initialsOf(profile.fullName)}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-ink">{profile.fullName}</p>
          <p className="truncate text-xs text-muted">{contact}</p>
        </div>
        <Link href="/careers/profile" className={linkClass}>Edit</Link>
      </div>
      <div className="flex flex-col gap-2 rounded-[20px] bg-lavender-soft px-4 py-3.5">
        <div className="flex items-start gap-2 text-[13px] font-medium text-primary">
          <p className="flex-1">Profile {strength.percent}% complete</p>
          {nextStep ? <Link href="/careers/profile" className="shrink-0 underline">{nextStep}</Link> : null}
        </div>
        <div role="progressbar" aria-label="Profile completeness" aria-valuenow={strength.percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded bg-white">
          <div className="h-1.5 rounded bg-primary" style={{ width: `${strength.percent}%` }} />
        </div>
        <p className="text-xs text-body">A complete profile helps our team get to know you faster.</p>
      </div>
      {documents[0] ? (
        <div className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white py-3.5 pl-3.5 pr-[18px]">
          <span aria-hidden className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-lavender-soft"><FileText className="size-[18px] text-primary" /></span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-ink">{documents[0].name}</p>
            <p className="text-xs text-muted">From your profile</p>
          </div>
          <Link href="/careers/profile" className={linkClass}>Replace</Link>
        </div>
      ) : null}
      {requiredDocuments.map((requiredDocument, index) => (
        <div key={`${requiredDocument}-${index}`} className="flex flex-col gap-1.5">
          <label htmlFor={`document-${index}`} className={labelClass}>{requiredDocument}<RequiredMark /></label>
          <select {...fieldProps(`document-${index}`)} required name="documentId" defaultValue="" className="rounded-[10px] border border-line bg-white px-3.5 py-[11px] text-sm text-ink">
            <option value="" disabled>Select a Document</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
          </select>
        </div>
      ))}
      {missingDocuments ? <p className="text-sm text-error">Upload the required Documents on your Applicant profile before submitting.</p> : null}
      <label className="flex items-start gap-3 text-xs leading-normal text-body">
        <input required name="privacyConsent" value="yes" type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-primary" />
        <span>I agree that Bren Raphael’s may use my information to review this application, as explained in the <Link href="/privacy" className="underline">Privacy notice</Link>.<RequiredMark /></span>
      </label>
      {state.message ? <p role="alert" className="text-sm text-error">{state.message}</p> : null}
      <SubmitButton disabled={missingDocuments} pendingLabel="Submitting…" className={buttonClass}>
        Submit application
        <ArrowRight aria-hidden className="size-4" />
      </SubmitButton>
      <p className="text-center text-xs text-muted">You can follow it anytime in <Link href="/careers/applications" className="underline">Your applications</Link>.</p>
    </form>
  );
}

/** The side card of a Job detail page: the Applicant's profile summary, the Documents the role requires and the submit action. */
export function ApplyCard({ jobPostingId, requiredDocuments, access }: { jobPostingId: string; requiredDocuments: string[]; access: ApplyAccess }) {
  return (
    <aside id="apply" className={cardClass}>
      {access.kind === "signed-out" ? <Gate title="Sign in to apply" message="Sign in as an Applicant before applying to this Job Posting." href="/careers/signin" label="Sign in" requiredDocuments={requiredDocuments} /> : null}
      {access.kind === "unverified" ? <Gate title="Verify your email to apply" message="Verify your Applicant email address before submitting an Application." href="/careers/verify-email" label="Verify email" requiredDocuments={requiredDocuments} /> : null}
      {access.kind === "no-profile" ? <Gate title="Complete your profile to apply" message="Save your Applicant profile before submitting an Application." href="/careers/complete-profile" label="Complete profile" requiredDocuments={requiredDocuments} /> : null}
      {access.kind === "ready" ? <ApplyForm jobPostingId={jobPostingId} requiredDocuments={requiredDocuments} access={access} /> : null}
    </aside>
  );
}
