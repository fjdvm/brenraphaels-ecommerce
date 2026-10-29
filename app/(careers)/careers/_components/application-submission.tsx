import { FileText } from "lucide-react";

import type { ApplicationDocument } from "@/lib/careers/applications";

import { applicationDate } from "./application-header";

type SubmittedProfile = { summary: string | null; skills: string; location: string | null };

function Answer({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-body">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

/** "What you sent": the submitted documents, applied date and the Applicant's answers; empty sections are left out. */
export function ApplicationSubmission({ appliedAt, documents, profile }: { appliedAt: Date; documents: ApplicationDocument[]; profile: SubmittedProfile }) {
  return (
    <section aria-labelledby="submission-heading" className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="submission-heading" className="text-lg font-semibold text-ink">
          What you sent
        </h2>
        <p className="text-xs text-body">Submitted {applicationDate.format(appliedAt)}</p>
      </div>
      {documents.length ? (
        <ul aria-label="Documents" className="flex flex-col gap-2">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <FileText aria-hidden className="size-5 shrink-0 text-primary" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-ink">{document.name}</span>
                <span className="text-xs text-body">{Math.max(1, Math.round(document.size / 1024))} KB</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {profile.summary || profile.skills || profile.location ? (
        <dl className="flex flex-col gap-3">
          {profile.location ? <Answer label="Location">{profile.location}</Answer> : null}
          {profile.skills ? <Answer label="Skills">{profile.skills}</Answer> : null}
          {profile.summary ? <Answer label="About you">{profile.summary}</Answer> : null}
        </dl>
      ) : null}
    </section>
  );
}
