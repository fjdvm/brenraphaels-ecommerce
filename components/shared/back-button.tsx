import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Always goes to `href`, not the browser history, so it lands in the same place however the visitor arrived. */
export function BackButton({ href }: { href: string }) {
  return (
    <Button asChild size="link-sm" variant="link">
      <Link href={href}>
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
    </Button>
  );
}
