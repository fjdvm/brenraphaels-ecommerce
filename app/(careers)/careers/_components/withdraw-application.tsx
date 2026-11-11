"use client";

import { useState, type FormEvent } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { withdrawApplicationAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { runWithToast } from "./action-toast";

/** A quiet text button that asks before withdrawing, with progress and the result in the shared card. */
export function WithdrawApplication({ referenceNumber }: { referenceNumber: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    // The card carries progress and the result, so the modal closes first; an open modal would also block the card's Retry.
    setOpen(false);
    try {
      await runWithToast({
        loading: "Withdrawing…",
        success: "Application withdrawn",
        error: "We couldn't withdraw your application. Try again.",
        // Retry sends the same Application again.
        task: () => withdrawApplicationAction(formData),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger disabled={pending} aria-busy={pending} className="self-start text-sm font-medium tracking-[0.35px] text-muted underline-offset-4 hover:text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Withdrawing…" : "Withdraw application"}</DialogTrigger>
      <DialogContent className="rounded-[28px] p-8 sm:p-10">
        <DialogTitle className="font-serif text-2xl text-primary">Withdraw this application?</DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-[1.5] tracking-[0.35px] text-body">
          The hiring team will stop considering you for this role. This can&apos;t be undone, but you can apply again later if it&apos;s still open.
        </DialogDescription>
        <form onSubmit={withdraw} className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="referenceNumber" value={referenceNumber} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Withdrawing…" : "Withdraw application"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
