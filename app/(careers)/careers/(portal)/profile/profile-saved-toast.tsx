"use client";

import { Bell, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** The "Your profile was saved." confirmation shown after a save redirects back with `?saved=1`. */
export function ProfileSavedToast() {
  const saved = useSearchParams()?.get("saved") === "1";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!saved) return;
    // Drop the flag so a refresh or a later visit does not show the toast again.
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [saved]);

  if (!saved || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed right-4 top-20 z-30 flex items-center gap-3 rounded-2xl bg-ink py-3.5 pl-3.5 pr-4 shadow-[0_12px_16px_rgba(43,26,69,0.25)] sm:right-10 sm:top-[118px]"
    >
      <span aria-hidden className="grid size-7 place-items-center rounded-[14px] bg-primary text-white">
        <Bell className="size-3.5" />
      </span>
      <p className="text-sm font-medium tracking-[0.35px] text-white">Your profile was saved.</p>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)} className="text-white/80 hover:text-white">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
