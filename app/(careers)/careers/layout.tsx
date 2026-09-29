import { Suspense } from "react";

import { ApplicantNav } from "./_components/applicant-nav";

export default function CareersLayout({ children }: LayoutProps<"/careers">) {
  return (
    <main className="min-h-screen bg-surface px-5 py-10 text-on-surface sm:px-8">
      <Suspense fallback={null}>
        <ApplicantNav />
      </Suspense>
      {children}
    </main>
  );
}
