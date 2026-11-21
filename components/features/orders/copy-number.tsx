"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** An account number with a Copy button, so a Customer can paste it into their banking app. */
export function CopyNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the number is still shown in full to copy by hand.
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-ink">{value}</span>
      <button
        aria-label={`Copy account number ${value}`}
        className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-xs font-medium text-primary hover:bg-lavender-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => void copy()}
        type="button"
      >
        {copied ? <Check aria-hidden className="size-3.5" strokeWidth={1.5} /> : <Copy aria-hidden className="size-3.5" strokeWidth={1.5} />}
        <span role="status">{copied ? "Copied" : "Copy"}</span>
      </button>
    </span>
  );
}
