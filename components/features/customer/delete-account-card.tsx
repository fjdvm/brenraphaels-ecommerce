"use client";

import { useState } from "react";

import {
  requestAccountDeletion,
  type DeleteAccountState,
} from "@/app/(site)/(protected)/profile/delete-account-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const failed = "We couldn't delete your account. Please check your connection and try again.";
const kindLabel = { order: "Order", return: "Return", ticket: "Ticket" } as const;

/**
 * Deleting an account is not optimistic: the confirm dialog comes first, then the spinner shows at once and the
 * result waits for the server. A refusal lists every Order, Return and Ticket still in progress.
 */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<DeleteAccountState>({});

  async function confirm() {
    setState({});
    setPending(true);
    try {
      // On success the action signs out and redirects, so the spinner stays until the page changes.
      const result = await requestAccountDeletion();
      if (result) {
        setState(result);
        setPending(false);
      }
    } catch {
      setState({ error: failed });
      setPending(false);
    }
  }

  const blockers = state.blockers ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-[1.6] tracking-[0.35px] text-body">
        You&apos;ll be signed out and won&apos;t be able to sign in again. Your past orders stay on record without your contact details.
      </p>
      <div className="flex justify-end">
        <Button onClick={() => { setState({}); setOpen(true); }} size="pill-sm" type="button" variant="pill-outline">
          Delete my account
        </Button>
      </div>
      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <DialogContent>
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">Delete your account?</DialogTitle>
          <DialogDescription className="mt-3 leading-7 text-on-surface-variant">
            This signs you out and turns off your login. You can&apos;t undo it from here.
          </DialogDescription>
          {blockers.length > 0 ? (
            <div className="mt-4 bg-surface px-8 py-4 text-sm text-body" role="alert">
              <p className="font-medium text-ink">Your account can&apos;t be deleted yet. Still in progress:</p>
              <ul className="mt-2 list-disc space-y-1 text-xs">
                {blockers.map((blocker) => (
                  <li key={`${blocker.kind}-${blocker.id}`}>
                    {kindLabel[blocker.kind]} #{blocker.id} ({blocker.status.replace("_", " ")})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {state.error ? <p className="mt-3 text-sm text-red-700" role="alert">{state.error}</p> : null}
          <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button disabled={pending} onClick={() => setOpen(false)} size="lg" type="button" variant="outline">
              Keep my account
            </Button>
            <Button aria-busy={pending} disabled={pending || blockers.length > 0} onClick={confirm} size="lg" type="button">
              {pending ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
