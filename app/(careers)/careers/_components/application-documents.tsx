import { Check, Clock, Upload } from "lucide-react";

import { requiredDocumentProgress, type RequiredDocument } from "@/lib/careers/application-offer";
import type { ApplicationDocument } from "@/lib/careers/applications";

/** Documents to submit: the required Documents HR-ATS reports, or, with none reported, the Documents already submitted. Upload is not available yet, so its buttons are disabled. */
export function ApplicationDocuments({ documents, required }: { documents: ApplicationDocument[]; required?: RequiredDocument[] | null }) {
  const rows: RequiredDocument[] = required?.length
    ? required
    : documents.map((document) => ({ name: document.name, hint: "Sent with your application", status: "Submitted" }));
  if (!rows.length) return null;
  const { done, total, percent } = requiredDocumentProgress(rows);
  return (
    <section aria-labelledby="documents-heading" className="flex flex-col gap-3 rounded-[28px] border border-line bg-white px-5 pb-4 pt-6 sm:gap-[18px] sm:rounded-[40px] sm:px-11 sm:pb-8 sm:pt-10">
      <div className="flex items-center gap-2 sm:gap-[18px]">
        <span className="hidden size-[52px] shrink-0 items-center justify-center rounded-full bg-lavender text-primary sm:flex">
          <Upload aria-hidden className="size-[22px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col sm:gap-1.5">
          <h2 id="documents-heading" className="font-serif text-lg leading-[1.35] text-primary sm:text-[28px] sm:leading-[1.25]">
            Documents to submit
          </h2>
          <p className="hidden text-sm tracking-[0.35px] text-body sm:block">Upload these so we can prepare your first day. Uploading here is coming soon.</p>
        </div>
        <p className="shrink-0 text-[13px] font-medium tracking-[0.35px] text-primary sm:text-sm">
          {done} of {total}
          <span className="hidden sm:inline"> done</span>
        </p>
      </div>
      <p className="text-xs tracking-[0.35px] text-body sm:hidden">Uploading here is coming soon.</p>
      <div role="progressbar" aria-label="Documents done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1.5 overflow-hidden rounded bg-lavender sm:h-2">
        <div className="h-full rounded bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <ul aria-label="Documents to submit" className="flex flex-col">
        {rows.map((row, index) => (
          <li key={`${row.name}-${index}`} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0 sm:gap-4 sm:py-4">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full sm:size-[26px] ${
                row.status === "Submitted" ? "bg-success text-white" : row.status === "In review" ? "bg-warning-soft text-warning" : "border border-line bg-white"
              }`}
            >
              {row.status === "Submitted" ? <Check aria-hidden className="size-3 sm:size-3.5" strokeWidth={3} /> : null}
              {row.status === "In review" ? <Clock aria-hidden className="size-3 sm:size-3.5" /> : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 tracking-[0.35px]">
              <span className="text-sm font-medium text-ink">{row.name}</span>
              {row.hint ? <span className="hidden text-xs text-muted sm:block">{row.hint}</span> : null}
            </span>
            {row.status === "To upload" ? (
              <button type="button" disabled className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] text-primary disabled:opacity-50">
                Upload
              </button>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.35px] ${row.status === "Submitted" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{row.status}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
