import { FileText, Heart } from "lucide-react";

import { formatMonthlyPay, toBeConfirmed, type ApplicationOffer as OfferTerms } from "@/lib/careers/application-offer";

import { applicationDate } from "./application-header";
import { OfferReplyControls } from "./offer-reply-controls";

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 px-3.5 py-3 text-sm tracking-[0.35px] sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-1.5 sm:rounded-3xl sm:bg-surface-soft sm:px-5 sm:py-[18px]">
      <dt className="min-w-0 flex-1 text-muted sm:flex-none sm:text-xs">{label}</dt>
      <dd className="shrink-0 font-medium text-ink sm:font-serif sm:text-lg sm:font-normal sm:leading-[1.35] sm:text-primary">{value}</dd>
    </div>
  );
}

/** Offer card: monthly pay, start date, schedule, reply-by date and letter from the optional Offer terms. Accept and Decline work only while `repliesEnabled` is on; View is not available yet. */
export function ApplicationOffer({ jobTitle, offer, referenceNumber = "", repliesEnabled = false }: { jobTitle: string | null; offer?: OfferTerms | null; referenceNumber?: string; repliesEnabled?: boolean }) {
  const replyBy = offer?.replyBy ? applicationDate.format(offer.replyBy) : null;
  const date = (value?: Date | null) => (value ? applicationDate.format(value) : toBeConfirmed);
  return (
    <section aria-labelledby="offer-heading" className="flex flex-col gap-4 rounded-[28px] border border-line bg-white px-5 pb-[22px] pt-6 sm:gap-6 sm:rounded-[40px] sm:px-11 sm:pb-10 sm:pt-11">
      <div className="flex items-center gap-3 sm:gap-[18px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success sm:size-[52px]">
          <Heart aria-hidden className="size-5 sm:size-[22px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col sm:gap-1.5">
          <h2 id="offer-heading" className="font-serif text-lg leading-[1.35] text-primary sm:text-[28px] sm:leading-[1.25]">
            We&apos;d love to have you on the team!
          </h2>
          <p className="hidden text-sm tracking-[0.35px] text-body sm:block">
            {jobTitle ? `Here's your offer for ${jobTitle}.` : "Here's your offer."} {replyBy ? `Please reply by ${replyBy}.` : ""}
          </p>
        </div>
      </div>
      <dl className="flex flex-col rounded-[18px] bg-surface-soft sm:flex-row sm:gap-3 sm:rounded-none sm:bg-transparent">
        <Term label="Monthly pay" value={formatMonthlyPay(offer?.monthlyPay)} />
        <Term label="Start date" value={date(offer?.startDate)} />
        <Term label="Schedule" value={offer?.schedule?.trim() || toBeConfirmed} />
        <div className="sm:hidden">
          <Term label="Reply by" value={date(offer?.replyBy)} />
        </div>
      </dl>
      <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white py-3 pl-3 pr-3.5 sm:gap-3.5 sm:py-3.5 sm:pl-3.5 sm:pr-[18px]">
        <span className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[10px] bg-lavender-soft text-primary sm:h-11 sm:w-10 sm:rounded-xl">
          <FileText aria-hidden className="size-4 sm:size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs tracking-[0.35px] text-muted">
          <span className="break-words text-sm font-medium text-ink">{offer?.letterName?.trim() || "Offer letter"}</span>
          {offer?.letterName ? "Read the full terms before you reply" : toBeConfirmed}
        </span>
        <button type="button" disabled className="py-1.5 text-sm font-medium tracking-[0.45px] text-primary disabled:opacity-50">
          View
        </button>
      </div>
      <OfferReplyControls
        referenceNumber={referenceNumber}
        enabled={repliesEnabled}
        offer={{ monthlyPay: formatMonthlyPay(offer?.monthlyPay), startDate: date(offer?.startDate), schedule: offer?.schedule?.trim() || toBeConfirmed, replyBy, jobTitle }}
      />
    </section>
  );
}
