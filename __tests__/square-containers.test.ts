import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Containers are square (AGENTS.md "Square containers"). Pills, buttons, badges, avatars and circular icon buttons
// use rounded-full; everything else must not round its corners. A file listed below still rounds a container and
// is migrated by a later square-look ticket; remove its entry when it is clean (a stale entry fails this test).
const root = path.resolve(import.meta.dirname, "..");
const roots = ["app", "components"];
const rounded = /(?<![\w-])rounded(?:-[trbl]{1,2})?(?:-(?!full\b|none\b)[\w\[\]./]+)?(?![\w-])/;
const allowed: Record<string, string> = {
  "app/(careers)/careers/(portal)/applications/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/loading.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/notifications/applicant-notifications-feed.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/notifications/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/profile/applicant-profile-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/profile/job-alerts-toggle.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-documents.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-end-state.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-interview.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-offer.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-progress-strip.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-sent.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-side-panels.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-skeleton.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-stepper.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-submission.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/apply-card.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/document-list.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/document-viewer.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/filter-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-detail-skeleton.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-detail.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-postings-list.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/offer-details-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/offer-reply-controls.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/reschedule-interview.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/skeletons.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/upload-document-dialog.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/withdraw-application.tsx": "Careers portal: square in the Careers slice",
  "app/(site)/page.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/careers/careers-header-shell.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-logo.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-nav-links.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/hero-images.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/how-hiring-works.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/why-work-with-us.tsx": "Careers portal: square in the Careers slice",
  "components/features/home/bestsellers.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/home/video-card.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/shared/auth-shell.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/footer.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/header.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/page-transition.tsx": "Shared shell logo/loader image: square in the Shell slice",
};

function sources(dir: string): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  return names.flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === "node_modules" ? [] : sources(file);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

const rounding = roots
  .flatMap((r) => sources(path.join(root, r)))
  .map((file) => path.relative(root, file).split(path.sep).join("/"))
  .filter((file) => rounded.test(readFileSync(path.join(root, file), "utf8")));

describe("square containers", () => {
  it("rounds no container outside the allowlist", () => {
    expect(rounding.filter((file) => !(file in allowed))).toEqual([]);
  });

  it("lists only files that still round a container", () => {
    expect(Object.keys(allowed).filter((file) => !rounding.includes(file))).toEqual([]);
  });
});
