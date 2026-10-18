"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button size="lg" type="submit" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/** Asks before signing out; only the confirm button submits `action`. */
export function SignOutButton({
  action,
  className,
  icon,
}: {
  action: () => Promise<void>;
  className?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "font-semibold hover:text-primary hover:underline hover:underline-offset-4",
          className,
        )}
      >
        {icon}
        Sign out
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="text-center">
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">
            Sign out?
          </DialogTitle>
          <DialogDescription className="mt-4 leading-7 text-on-surface-variant">
            You&apos;ll need to sign in again to see your profile.
          </DialogDescription>
          <form
            action={action}
            className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Stay signed in
            </Button>
            <ConfirmButton />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
