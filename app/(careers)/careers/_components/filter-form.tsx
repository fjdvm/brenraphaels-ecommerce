"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Job Posting filters: submits through the router so the Filter button can show a pending state. */
export function FilterForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const [name, value] of formData) if (typeof value === "string" && value) params.set(name, value);
    router.push(params.size > 0 ? `/careers?${params}` : "/careers");
  }
  return <form action={applyFilters} className={className}>{children}</form>;
}
