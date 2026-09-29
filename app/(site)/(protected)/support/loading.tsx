import { SupportContentSkeleton } from "@/components/features/support/skeletons";

export default function Loading() {
  return (
    <section>
      <h2 className="font-serif text-3xl text-primary">Support</h2>
      <p className="mt-2 text-on-surface-variant">Open a Ticket and keep track of your conversations with us.</p>
      <SupportContentSkeleton />
    </section>
  );
}
