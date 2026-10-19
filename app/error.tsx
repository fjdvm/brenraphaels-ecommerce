"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Catches a render failure in any route so visitors get a retry button and a way home, not the bare framework page. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-5 py-16">
      <h1 className="font-serif text-3xl text-primary">Something went wrong</h1>
      <p className="text-on-surface-variant">We couldn&apos;t load this page. Please try again.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="pill" size="pill-lg" onClick={reset}>Try again</Button>
        <Button asChild variant="link" size="pill-lg" className="px-0 py-2.5"><Link href="/">Back to home</Link></Button>
      </div>
      {error.digest && <p className="font-mono text-xs text-on-surface-variant">Error {error.digest}</p>}
    </main>
  );
}
