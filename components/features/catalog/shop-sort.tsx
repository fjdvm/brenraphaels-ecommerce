"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { shopHref } from "@/components/features/catalog/shop-href";
import { sortOptions, type BrowseParams, type Sort } from "@/lib/catalog/browse";

/** "Sort: …" pill; picking an option updates the URL, which the server renders. */
export function ShopSort({ params }: { params: BrowseParams }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="relative inline-flex items-center rounded-full border border-line bg-white py-[11px] pl-[22px] pr-[18px] text-sm font-medium tracking-wide text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
      <span className="sr-only">Sort products</span>
      <select
        value={params.sort ?? "featured"}
        onChange={(event) => router.push(shopHref(pathname, { ...params, sort: event.target.value as Sort }), { scroll: false })}
        className="cursor-pointer appearance-none bg-transparent pr-6 outline-none"
      >
        {sortOptions.map(({ value, label }) => (
          <option key={value} value={value}>Sort: {label}</option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-[18px] size-4" />
    </label>
  );
}
