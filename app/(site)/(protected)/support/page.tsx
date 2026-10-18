import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Support" };

/** The right pane before a conversation is chosen. */
export default function SupportPage() {
  return (
    <div className="hidden h-full min-h-[600px] flex-col items-center justify-center gap-4 p-10 text-center lg:flex">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-lavender text-primary">
        <MessageCircle className="size-6" strokeWidth={1.5} />
      </span>
      <h2 className="font-serif text-[28px] leading-[1.25] text-primary">Pick a conversation</h2>
      <p className="max-w-sm leading-[1.6] tracking-[0.35px] text-body">
        Choose a ticket from the list, or open a new one and we&apos;ll reply within the day (Mon–Sat).
      </p>
      <Button asChild size="pill-sm" variant="pill-outline">
        <Link href="/support/new">New ticket</Link>
      </Button>
    </div>
  );
}
