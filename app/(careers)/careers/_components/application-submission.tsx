import type { ApplicationDocument } from "@/lib/careers/applications";

import { DocumentList } from "./document-list";
import { applicationDate } from "./application-header";

type SubmittedProfile = { summary: string | null; skills: string; location: string | null };

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Manila" });

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
    <section aria-labelledby="submission-heading" className="flex flex-col gap-4 border border-line bg-white p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="submission-heading" className="text-lg font-semibold text-ink">
          What you sent
        </h2>
        <p className="text-xs text-body">Submitted {applicationDate.format(appliedAt)}</p>
      </div>
      {documents.length ? (
        <DocumentList documents={documents} note={`sent ${shortDate.format(appliedAt)}`} className="gap-2" />
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
