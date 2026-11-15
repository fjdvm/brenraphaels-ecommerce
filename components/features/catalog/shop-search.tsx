"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { shopHref } from "@/components/features/catalog/shop-href";
import type { BrowseParams } from "@/lib/catalog/browse";

/** Product-name search; submitting updates the URL, which the server renders. */
export function ShopSearch({ params }: { params: BrowseParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(params.q ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(shopHref(pathname, { ...params, q: value.trim() || undefined }), { scroll: false });
  }

  return (
    <form role="search" onSubmit={submit} className="relative flex max-w-[520px] items-center">
      <Search aria-hidden className="pointer-events-none absolute left-4 size-4 text-muted" />
      <input
        type="search"
        name="q"
        value={value}
        maxLength={80}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
        aria-label="Search products by name"
        className="w-full border border-line bg-white py-3 pl-11 pr-4 text-sm tracking-wide text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </form>
  );
}
