"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Greets a newly Verified Customer; closing it by any route ends on plain home. */
export function WelcomeModal({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    // Drops ?welcome=1 so a reload does not show the welcome again.
    router.replace("/");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-secondary">
          Bren Raphael&apos;s &middot; Ube Jam &amp; Halaya
        </p>
        <DialogTitle className="mt-6 font-serif text-4xl leading-tight text-primary">
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}
        </DialogTitle>
        <DialogDescription className="mt-4 leading-7 text-on-surface-variant">
          Your email is verified. Your account is ready, and the ube is waiting.
        </DialogDescription>
        <button
          type="button"
          onClick={close}
          className="welcome-reveal mt-8 inline-flex bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Start shopping
        </button>
      </DialogContent>
    </Dialog>
  );
}
