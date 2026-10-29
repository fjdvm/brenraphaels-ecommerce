import { Check, Upload } from "lucide-react";

import type { ApplicationDocument } from "@/lib/careers/applications";

/** Offer-stage documents card: what the Applicant submitted, read-only (no upload rows); hidden when nothing was submitted. */
export function ApplicationDocuments({ documents }: { documents: ApplicationDocument[] }) {
  if (!documents.length) return null;
  return (
    <section aria-labelledby="documents-heading" className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-lavender text-primary">
          <Upload aria-hidden className="size-[18px]" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id="documents-heading" className="text-lg font-semibold text-ink">
            Documents
          </h2>
          <p className="text-[13px] text-body">The documents you sent with your application.</p>
        </div>
      </div>
      <ul aria-label="Submitted documents" className="flex flex-col">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-green-600">
              <Check aria-hidden className="size-3 text-white" strokeWidth={3} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium text-ink">{document.name}</span>
              <span className="text-xs text-body">Sent with your application</span>
            </span>
            <span className="text-[13px] font-semibold text-green-700">Submitted</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
