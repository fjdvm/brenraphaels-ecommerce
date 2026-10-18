import { Suspense } from "react";

import { CareersFooter } from "@/components/features/careers/careers-footer";
import { CareersHeader, CareersHeaderFallback } from "@/components/features/careers/careers-header";

export default function CareersPortalLayout({ children }: LayoutProps<"/careers">) {
  return (
    <>
      <Suspense fallback={<CareersHeaderFallback />}>
        <CareersHeader />
      </Suspense>
      <main className="flex-1 bg-surface text-on-surface">{children}</main>
      <CareersFooter />
    </>
  );
}
