"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { submitApplicationAction } from "@/app/(careers)/careers/(portal)/[id]/apply/actions";
import { RequiredMark, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { initialsOf } from "@/lib/customer/initials";
import type { ApplicantProfile } from "@/lib/careers/profile";

type Document = { id: number; name: string };

/** What the visitor can do from the card: apply, or the step they must finish first. */
export type ApplyAccess =
  | { kind: "signed-out" }
  | { kind: "unverified" }
  | { kind: "no-profile" }
  | { kind: "ready"; email: string; profile: ApplicantProfile; documents: Document[] };

const cardClass = "flex w-full shrink-0 flex-col gap-[18px] rounded-[20px] border border-line bg-white p-6 shadow-[0_12px_16px_rgba(61,28,92,0.08)] lg:w-[420px]";
const headingClass = "text-xl font-semibold text-ink";
const labelClass = "flex gap-[3px] text-[13px] font-medium text-ink";
const linkClass = "text-[13px] font-semibold text-primary";
const buttonClass = "flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-on-primary";

function Gate({ title, message, href, label }: { title: string; message: string; href: string; label: string }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={headingClass}>{title}</h2>
        <p className="text-sm leading-[21px] text-body">{message}</p>
      </div>
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

  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <input type="hidden" name="jobPostingId" value={jobPostingId} />
      <div className="flex flex-col gap-1">
        <h2 className={headingClass}>Apply with your profile</h2>
        <p className="text-sm leading-[21px] text-body">We’ll send your saved profile and selected Documents. Check them before you submit.</p>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-surface-container-low py-3 pl-3 pr-3.5">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">{initialsOf(profile.fullName)}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[15px] font-semibold text-ink">{profile.fullName}</p>
          <p className="truncate text-xs text-muted">{contact}</p>
        </div>
        <Link href="/careers/profile" className={linkClass}>Edit</Link>
      </div>
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
      <label className="flex items-start gap-2.5 text-[13px] leading-[19px] text-body">
        <input required name="privacyConsent" value="yes" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span>I consent to Bren Raphael’s using my profile and selected Documents to process this Application.<RequiredMark /></span>
      </label>
      {state.message ? <p role="alert" className="text-sm text-error">{state.message}</p> : null}
      <SubmitButton disabled={missingDocuments} pendingLabel="Submitting…" className={buttonClass}>
        Submit application
        <ArrowRight aria-hidden className="size-4" />
      </SubmitButton>
      <p className="text-center text-xs text-muted">You can follow it anytime in My applications.</p>
    </form>
  );
}

/** The side card of a Job detail page: the Applicant's profile summary, the Documents the role requires and the submit action. */
export function ApplyCard({ jobPostingId, requiredDocuments, access }: { jobPostingId: string; title: string; requiredDocuments: string[]; access: ApplyAccess }) {
  return (
    <aside className={cardClass}>
      {access.kind === "signed-out" ? <Gate title="Sign in to apply" message="Sign in as an Applicant before applying to this Job Posting." href="/careers/signin" label="Sign in" /> : null}
      {access.kind === "unverified" ? <Gate title="Verify your email to apply" message="Verify your Applicant email address before submitting an Application." href="/careers/verify-email" label="Verify email" /> : null}
      {access.kind === "no-profile" ? <Gate title="Complete your profile to apply" message="Save your Applicant profile before submitting an Application." href="/careers/complete-profile" label="Complete profile" /> : null}
      {access.kind === "ready" ? <ApplyForm jobPostingId={jobPostingId} requiredDocuments={requiredDocuments} access={access} /> : null}
    </aside>
  );
}
