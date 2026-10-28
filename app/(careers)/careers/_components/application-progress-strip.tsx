import type { ApplicationProgress } from "@/lib/careers/application-progress";

/** Five-segment step strip with its "Step N of 5" or "Closed" label, shown on each Application row. */
export function ApplicationProgressStrip({ progress }: { progress: ApplicationProgress }) {
  const label = progress.closed ? "Closed" : `Step ${progress.step} of ${progress.total}`;
  return (
    <div className="flex items-center justify-end gap-3 rounded-xl bg-surface-soft px-3.5 py-3" role="group" aria-label={label}>
      <div aria-hidden className="flex items-center gap-1.5">
        {Array.from({ length: progress.total }, (_, index) => (
          <span key={index} className={`h-1.5 w-7 rounded-[3px] ${progress.closed ? "bg-line" : index < progress.step ? "bg-primary" : "bg-lavender"}`} />
        ))}
      </div>
      <p className="text-xs font-medium tracking-[0.35px] text-body">{label}</p>
    </div>
  );
}
