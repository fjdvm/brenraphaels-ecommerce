import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";

/** The Address book heading, shared by the page and its loading state so nothing shifts. */
export function AddressBookHeading() {
  return (
    <PageHeading
      aside={
        <Button asChild size="pill-lg" variant="pill">
          <Link href="/profile/addresses?add=1" scroll={false}>
            Add address
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </Button>
      }
      eyebrow="My account"
      title="Address book"
    >
      <p className="tracking-[0.35px] text-body">Manage where we deliver your orders.</p>
    </PageHeading>
  );
}
