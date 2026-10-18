"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** Goes back to the page the visitor came from, or to `fallbackHref` when they landed here directly. */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <Button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      size="link-sm"
      type="button"
      variant="link"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back
    </Button>
  );
}
