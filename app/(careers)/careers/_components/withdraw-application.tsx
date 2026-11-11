"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { withdrawApplicationAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { SubmitButton } from "./submit-button";

/** A quiet text button that asks before calling the existing withdraw action. */
export function WithdrawApplication({ referenceNumber }: { referenceNumber: string }) {
  return (
    <Dialog>
      <DialogTrigger className="self-start text-sm font-medium tracking-[0.35px] text-muted underline-offset-4 hover:text-primary hover:underline">Withdraw application</DialogTrigger>
      <DialogContent className="rounded-[28px] p-8 sm:p-10">
        <DialogTitle className="font-serif text-2xl text-primary">Withdraw this application?</DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-[1.5] tracking-[0.35px] text-body">
          The hiring team will stop considering you for this role. This can&apos;t be undone, but you can apply again later if it&apos;s still open.
        </DialogDescription>
        <form action={withdrawApplicationAction} className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="referenceNumber" value={referenceNumber} />
          <SubmitButton pendingLabel="Withdrawing…" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium tracking-[0.45px] text-white">
            Withdraw application
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
