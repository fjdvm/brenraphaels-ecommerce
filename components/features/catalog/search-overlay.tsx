"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronRight, Clock, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { shopHref } from "@/components/features/catalog/shop-href";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addRecentSearch,
  matchResults,
  maxOverlayResults,
  type SearchResult,
} from "@/lib/catalog/search-results";

const recentKey = "shop-recent-searches";
const popular = ["Halaya 500g", "Ube jam", "Bestsellers", "Gift sets"];

let cached: SearchResult[] | undefined;
let inflight: Promise<SearchResult[]> | undefined;

/** Loads the Shop's Products once per page load; called on hover or focus so the overlay opens with them ready. */
export function prefetchSearchResults(): Promise<SearchResult[]> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch("/api/shop/search")
    .then((response) => {
      if (!response.ok) throw new Error("unavailable");
      return response.json() as Promise<{ results: SearchResult[] }>;
    })
    .then(({ results }) => (cached = results))
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** Forgets the loaded Products so the next open fetches fresh stock. */
export function clearSearchCache() {
  cached = undefined;
}

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(items: string[]) {
  try {
    localStorage.setItem(recentKey, JSON.stringify(items));
  } catch {
    /* private window: recent searches simply are not remembered */
  }
}

export function StockLabelPill({ result }: { result: SearchResult }) {
  if (!result.stock) return null;
  const tone = result.stock.kind === "sold-out" ? "bg-surface text-muted" : "bg-warning-soft text-warning";
  return <span className={`rounded-full px-3 py-1 text-xs tracking-wide ${tone}`}>{result.stock.text}</span>;
}

function ResultRow({ result, active, mobile, onOpen }: { result: SearchResult; active?: boolean; mobile: boolean; onOpen: (slug: string) => void }) {
  const photo = mobile ? "size-14" : "size-16";
  return (
    <button
      type="button"
      onClick={() => onOpen(result.slug)}
      className={`flex w-full items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        mobile ? "py-1" : "p-3 hover:bg-lavender-soft"
      } ${active ? "bg-lavender-soft" : ""}`}
    >
      <Image src={result.image} alt="" width={64} height={64} className={`${photo} shrink-0 object-cover ${result.stock?.kind === "sold-out" ? "opacity-55" : ""}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-serif text-[18px] leading-[1.35] text-ink">{result.name}</span>
        <span className="truncate text-xs tracking-wide text-muted md:block">
          <span className="hidden md:inline">{result.meta}</span>
          <span className="text-primary md:hidden">{result.price}</span>
        </span>
      </span>
      <StockLabelPill result={result} />
      <span className="hidden text-sm font-medium tracking-wide text-primary md:block">{result.price}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  );
}

/** Mounted only while open, so each opening reads the recent searches fresh and starts with an empty box. */
export function SearchOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return open ? <SearchPanel onOpenChange={onOpenChange} /> : null;
}

function SearchPanel({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchResult[] | undefined>(cached);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (products) return;
    let current = true;
    prefetchSearchResults().then(
      (results) => current && setProducts(results),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [products, attempt]);

  const trimmed = query.trim();
  const matches = products ? matchResults(products, trimmed) : [];
  const shown = matches.slice(0, maxOverlayResults);
  const suggestions = matches.slice(0, 3).map(({ name }) => name.toLowerCase());

  function remember(text: string) {
    const next = addRecentSearch(readRecent(), text);
    setRecent(next);
    writeRecent(next);
  }

  function close() {
    onOpenChange(false);
  }

  function seeAll(text: string) {
    if (!text.trim()) return;
    remember(text);
    close();
    router.push(shopHref("/products", { q: text.trim() }));
  }

  function openProduct(slug: string) {
    if (trimmed) remember(trimmed);
    close();
    router.push(`/products/${slug}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    seeAll(query);
  }

  function pick(text: string) {
    setQuery(text);
    inputRef.current?.focus();
  }

  function forget(text: string) {
    const next = recent.filter((item) => item !== text);
    setRecent(next);
    writeRecent(next);
  }

  const loading = !products && !failed;

  return (
    <DialogPrimitive.Root open onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-tertiary/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col gap-[18px] overflow-y-auto bg-white px-4 pb-6 pt-[52px] shadow-[0_20px_24px_rgba(43,26,69,0.15)] focus:outline-none md:inset-x-0 md:bottom-auto md:max-h-[90vh] md:gap-6 md:px-10 md:pb-8 md:pt-7"
        >
          <DialogPrimitive.Title className="sr-only">Search the shop</DialogPrimitive.Title>
          <form role="search" onSubmit={submit} className="flex items-center gap-2.5 md:gap-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-4 py-[13px] md:px-5 md:py-4">
              <Search aria-hidden className="size-[18px] shrink-0 text-primary md:size-5" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                maxLength={80}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products"
                aria-label="Search products by name"
                className="min-w-0 flex-1 bg-transparent text-base tracking-wide text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => pick("")} className="hidden text-[13px] font-medium tracking-wide text-muted hover:text-primary md:block">
                  Clear
                </button>
              )}
            </div>
            <DialogPrimitive.Close className="hidden size-12 shrink-0 place-items-center rounded-full bg-surface text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary md:grid" aria-label="Close search">
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
            <DialogPrimitive.Close className="text-sm font-medium tracking-wide text-primary md:hidden">Cancel</DialogPrimitive.Close>
          </form>

          <div className="flex flex-col gap-[18px] md:flex-row md:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:gap-2.5" aria-live="polite">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Products</p>
              {loading && trimmed ? (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : failed && trimmed ? (
                <p role="alert" className="text-sm text-body">
                  Search is unavailable right now.{" "}
                  <button type="button" className="font-medium text-primary underline" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>
                    Try again
                  </button>
                </p>
              ) : !trimmed ? (
                <p className="text-sm text-body">Type a product name, like “halaya”.</p>
              ) : shown.length === 0 ? (
                <p className="text-sm text-body">No products match “{trimmed}”.</p>
              ) : (
                <>
                  {shown.map((result, index) => (
                    <div key={result.slug}>
                      <div className="hidden md:block"><ResultRow result={result} active={index === 0} mobile={false} onOpen={openProduct} /></div>
                      <div className="md:hidden"><ResultRow result={result} mobile onOpen={openProduct} /></div>
                    </div>
                  ))}
                  <button type="button" onClick={() => seeAll(query)} className="self-start text-sm font-medium tracking-wide text-primary">
                    See all {matches.length} {matches.length === 1 ? "result" : "results"} for “{trimmed}” →
                  </button>
                </>
              )}
            </div>

            <aside className="flex flex-col gap-3.5 md:w-[420px] md:shrink-0">
              {suggestions.length > 0 && (
                <div className="hidden flex-col gap-3.5 md:flex">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Suggestions</p>
                  {suggestions.map((text) => (
                    <button key={text} type="button" onClick={() => pick(text)} className="flex items-center gap-2.5 text-left text-sm tracking-wide text-ink hover:text-primary">
                      <Search aria-hidden className="size-3.5 text-muted" />
                      {text}
                    </button>
                  ))}
                </div>
              )}
              {recent.length > 0 && (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                    <span className="md:hidden">Recent searches</span>
                    <span className="hidden md:inline">Recent</span>
                  </p>
                  <ul className="flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-2">
                    {recent.map((text) => (
                      <li key={text} className="flex items-center gap-3 md:gap-1.5 md:rounded-full md:border md:border-line md:py-2 md:pl-3.5 md:pr-3">
                        <Clock aria-hidden className="size-4 text-muted md:hidden" />
                        <button type="button" onClick={() => seeAll(text)} className="flex-1 text-left text-sm tracking-wide text-ink hover:text-primary">
                          {text}
                        </button>
                        <button type="button" onClick={() => forget(text)} aria-label={`Remove ${text} from recent searches`} className="text-muted hover:text-primary">
                          <X aria-hidden className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted md:hidden">Popular</p>
              <div className="flex flex-wrap gap-2 md:hidden">
                {popular.map((text) => (
                  <button key={text} type="button" onClick={() => seeAll(text)} className="rounded-full border border-line px-3.5 py-2 text-sm tracking-wide text-ink">
                    {text}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
