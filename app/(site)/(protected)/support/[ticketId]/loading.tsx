import Link from "next/link";

import { TicketDetailSkeleton } from "@/components/features/support/skeletons";

export default function Loading() {
  return (
    <section>
      <Link className="text-sm font-semibold text-primary underline" href="/support">Back to Support</Link>
      <TicketDetailSkeleton />
    </section>
  );
}
