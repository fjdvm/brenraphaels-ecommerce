"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export function BackLink({
  fallbackHref = "/",
  className,
  children = "Back",
}: {
  fallbackHref?: string;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
