"use client";

import { useState } from "react";

/** Shares the role with the device share sheet, or copies its link when the browser has none. */
export function ShareRoleButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // The Applicant dismissed the share sheet; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: leave the button as it is.
    }
  }

  return (
    <>
      <button type="button" onClick={share} className={className}>
        Share role
      </button>
      <span role="status" className="sr-only">{copied ? "Link copied" : ""}</span>
      {copied ? <span aria-hidden className="text-xs text-muted">Link copied</span> : null}
    </>
  );
}
