import type { ApplicantProfile } from "@/lib/careers/profile";

/** How much of the reusable Applicant profile is filled in, as a percentage and a checklist. */
export function profileStrength({ profile, documentCount }: { profile?: ApplicantProfile; documentCount: number }) {
  const steps = [
    { label: "Basic information", done: Boolean(profile) },
    { label: "Résumé uploaded", done: documentCount > 0 },
    { label: "Summary & skills", done: Boolean(profile?.summary?.trim() || profile?.skills.trim()) },
    { label: "Education", done: (profile?.education.length ?? 0) > 0 },
    { label: "Work history", done: (profile?.workHistory.length ?? 0) > 0 },
  ];
  return { percent: Math.round((steps.filter((step) => step.done).length / steps.length) * 100), steps };
}
