"use client";

import { ArrowRight, FileText } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { acceptOfferAction, declineOfferAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { offerRepliesComingSoon } from "@/lib/careers/offer-reply";

import { runWithToast } from "./action-toast";

export type OfferSummary = { monthlyPay: string; startDate: string; schedule: string; replyBy: string | null; jobTitle: string | null };

const primaryButton = "rounded-full bg-primary px-9 py-4 text-lg tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-full border border-primary px-9 py-4 text-lg tracking-[0.45px] text-primary disabled:cursor-not-allowed disabled:opacity-50";

/** Centred dialog on desktop, bottom sheet on mobile, from the same content. */
function ReplySheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="bottom-0 left-0 top-auto max-w-none translate-x-0 translate-y-0 rounded-b-none border-0 p-0 shadow-[0_-8px_16px_rgba(43,26,69,0.2)] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 bg-line sm:hidden" />
        <div className="flex items-center gap-2.5 py-2.5 pl-5 pr-4 sm:items-start sm:gap-3 sm:pb-4 sm:pl-8 sm:pr-6 sm:pt-7">
          <DialogTitle className="flex-1 font-serif text-[22px] leading-[1.3] text-primary">{title}</DialogTitle>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 px-3.5 py-3 sm:px-[18px] sm:py-3.5">
      <dt className="min-w-0 flex-1 text-muted">{label}</dt>
      <dd className="shrink-0 font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Accept offer and Decline with their confirmations; the answer goes to HRMS. While replies are switched off they are visible but disabled and no request is made. */
export function OfferReplyControls({ referenceNumber, enabled, offer }: { referenceNumber: string; enabled: boolean; offer: OfferSummary }) {
  const [dialog, setDialog] = useState<"accept" | "decline" | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (next) return;
    setDialog(null);
    setAgreed(false);
  }

  async function send(event: FormEvent<HTMLFormElement>, kind: "accept" | "decline") {
    event.preventDefault();
    if (pending || (kind === "accept" && !agreed)) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    // The card carries progress and the result, so the dialog closes first; an open dialog would also block the card's Retry.
    close(false);
    try {
      await runWithToast(
        kind === "accept"
          ? { loading: "Accepting offer…", success: "Offer accepted", error: "We couldn't accept your offer. Try again.", task: () => acceptOfferAction(formData) }
          : { loading: "Declining offer…", success: "Offer declined", error: "We couldn't decline your offer. Try again.", task: () => declineOfferAction(formData) },
      );
    } finally {
      setPending(false);
    }
  }

  const role = offer.jobTitle ? `the ${offer.jobTitle} role` : "this role";
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" disabled={!enabled || pending} onClick={() => setDialog("accept")} className={`${primaryButton} inline-flex items-center justify-center gap-2.5`}>
          Accept offer
          <ArrowRight aria-hidden className="size-5" />
        </button>
        <button type="button" disabled={!enabled || pending} onClick={() => setDialog("decline")} className={secondaryButton}>
          Decline
        </button>
        <p className="text-sm tracking-[0.35px] text-muted sm:ml-auto sm:text-right">
          {offer.replyBy ? `Reply by ${offer.replyBy}. ` : ""}
          {enabled ? "" : offerRepliesComingSoon}
        </p>
      </div>

      <ReplySheet open={dialog === "accept"} onOpenChange={close} title="Accept this offer?">
        <form onSubmit={(event) => send(event, "accept")}>
          <input type="hidden" name="referenceNumber" value={referenceNumber} />
          <div className="flex flex-col gap-3.5 px-5 pb-4 pt-2 sm:gap-4 sm:px-8 sm:pb-6">
            <DialogDescription className="text-sm leading-[1.5] tracking-[0.35px] text-body">You&apos;re accepting {role} at Bren Raphael&apos;s.</DialogDescription>
            <dl className="flex flex-col bg-surface-soft text-sm tracking-[0.35px]">
              <SummaryRow label="Monthly pay" value={offer.monthlyPay} />
              <SummaryRow label="Start date" value={offer.startDate} />
              <SummaryRow label="Schedule" value={offer.schedule} />
            </dl>
            <label className="flex items-start gap-2.5 text-sm leading-[1.5] tracking-[0.35px] text-ink sm:gap-3">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-primary" />
              I&apos;ve read the offer terms and agree to them.
            </label>
            <p className="hidden items-start gap-2.5 bg-lavender-soft px-3.5 py-3 text-xs leading-[1.5] tracking-[0.35px] text-primary sm:flex">
              <FileText aria-hidden className="mt-0.5 size-4 shrink-0" />
              Next, upload your remaining documents so we can prepare your first day.
            </p>
          </div>
          <div className="flex flex-col gap-2 border-t border-line px-5 pb-7 pt-3 sm:flex-row-reverse sm:justify-start sm:gap-2.5 sm:px-8 sm:pb-6 sm:pt-[18px]">
            <button type="submit" disabled={!agreed || pending} className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-9 py-4 text-lg tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-[22px] sm:py-2.5 sm:text-sm sm:font-medium">
              Yes, accept offer
              <ArrowRight aria-hidden className="size-5 sm:hidden" />
            </button>
            <button type="button" onClick={() => close(false)} className="rounded-full py-2.5 text-lg tracking-[0.45px] text-primary sm:border sm:border-primary sm:px-[22px] sm:text-sm sm:font-medium">
              Not yet
            </button>
          </div>
        </form>
      </ReplySheet>

      <ReplySheet open={dialog === "decline"} onOpenChange={close} title="Decline this offer?">
        <form onSubmit={(event) => send(event, "decline")}>
          <input type="hidden" name="referenceNumber" value={referenceNumber} />
          <div className="flex flex-col gap-3.5 px-5 pb-4 pt-2 sm:gap-4 sm:px-8 sm:pb-6">
            <DialogDescription className="text-sm leading-[1.5] tracking-[0.35px] text-body">You&apos;re declining {role} at Bren Raphael&apos;s. This can&apos;t be undone.</DialogDescription>
          </div>
          <div className="flex flex-col gap-2 border-t border-line px-5 pb-7 pt-3 sm:flex-row-reverse sm:justify-start sm:gap-2.5 sm:px-8 sm:pb-6 sm:pt-[18px]">
            <button type="submit" disabled={pending} className="rounded-full bg-primary px-9 py-4 text-lg tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-[22px] sm:py-2.5 sm:text-sm sm:font-medium">
              Yes, decline offer
            </button>
            <button type="button" onClick={() => close(false)} className="rounded-full py-2.5 text-lg tracking-[0.45px] text-primary sm:border sm:border-primary sm:px-[22px] sm:text-sm sm:font-medium">
              Not yet
            </button>
          </div>
        </form>
      </ReplySheet>
    </>
  );
}
