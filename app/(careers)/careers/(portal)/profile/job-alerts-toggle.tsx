"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { setApplicantJobAlerts } from "./actions";

const cardClass = "flex flex-col gap-4 rounded-[40px] border border-line bg-white p-6 sm:p-10";

/** Saves on change; a failed save restores the previous state and says why. */
export function JobAlertsToggle({ initial, profileSaved }: { initial: boolean; profileSaved: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const previous = enabled;
    const next = !previous;
    setEnabled(next);
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await setApplicantJobAlerts({ jobAlertsOptIn: next });
        if ("message" in result) {
          setEnabled(previous);
          setError(result.message);
        }
      } catch {
        setEnabled(previous);
        setError("We couldn't save your job-alert preference. Try again.");
      }
    });
  }

  return (
    <section className={cardClass}>
      <h2 className="font-serif text-[22px] leading-[1.3] text-primary">Job alerts</h2>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <label id="job-alerts-label" htmlFor="job-alerts" className="block text-sm font-medium tracking-[0.35px] text-ink">
            Email me about new Job Postings
          </label>
          <p id="job-alerts-hint" className="text-xs tracking-[0.35px] text-muted">
            {profileSaved ? "Off by default. Change it any time." : "Save your profile first to turn this on."}
          </p>
        </div>
        <button
          id="job-alerts"
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="job-alerts-label"
          aria-describedby="job-alerts-hint"
          disabled={!profileSaved || pending}
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
            enabled ? "bg-primary" : "bg-line",
          )}
        >
          <span aria-hidden className={cn("absolute left-0.5 top-0.5 size-6 rounded-full bg-white transition-transform", enabled && "translate-x-5")} />
        </button>
      </div>
      <p className="text-sm tracking-[0.35px] text-body" role="status">
        {error ? <span className="text-red-700">{error}</span> : enabled ? "Job-alert emails are on." : "Job-alert emails are off."}
      </p>
    </section>
  );
}
