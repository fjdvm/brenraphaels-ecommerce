"use client";

import { Sparkles, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const AssistantChat = lazy(() => import("./assistant-chat").then((module) => ({ default: module.AssistantChat })));

/** Shown the moment the panel opens, while the chat loads. */
export function AssistantSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the assistant" className="flex flex-1 flex-col gap-3.5 p-4" role="status">
      <Skeleton className="h-16 w-4/5" />
      <Skeleton className="ml-auto h-10 w-1/2" />
      <Skeleton className="h-28 w-4/5" />
    </div>
  );
}

/** The launcher and the panel. The panel opens at once; the chat streams in behind a skeleton. */
export function OrderAssistant({ pageOrderId }: { pageOrderId?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? null : (
        <button
          aria-label="Ask the Order assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium tracking-[0.45px] text-white shadow-lg"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Sparkles aria-hidden className="size-4" />
          Ask about an order
        </button>
      )}
      {open ? (
        <section
          aria-label="Order assistant"
          className="fixed inset-0 z-50 flex flex-col bg-surface sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:w-[400px] sm:border sm:border-line sm:shadow-xl"
          role="dialog"
        >
          <header className="flex items-center gap-3 bg-tertiary px-5 py-4">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-lavender text-primary">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="font-serif text-lg leading-[1.35] text-white">Order assistant</h2>
              <p className="text-xs tracking-[0.35px] text-accent">AI assistant · Our team takes over anytime</p>
            </div>
            <button aria-label="Close the assistant" className="text-white" onClick={() => setOpen(false)} type="button">
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <Suspense fallback={<AssistantSkeleton />}>
            <AssistantChat pageOrderId={pageOrderId} />
          </Suspense>
        </section>
      ) : null}
    </>
  );
}
