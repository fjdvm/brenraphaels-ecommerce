import { Heart, PartyPopper } from "lucide-react";

import { formatMonthlyPay, isOfferOverdue, manilaToday, offerDate, type ApplicationOffer as Offer, type OfferView } from "@/lib/careers/application-offer";

import { applicationDate } from "./application-header";
import { OfferReplyControls } from "./offer-reply-controls";

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 px-3.5 py-3 text-sm tracking-[0.35px] sm:min-w-0 sm:flex-col sm:gap-1.5 sm:bg-surface-soft sm:px-5 sm:py-[18px]">
      <dt className="min-w-0 flex-1 text-muted sm:flex-none sm:text-xs">{label}</dt>
      <dd className="shrink-0 break-words font-medium text-ink sm:font-serif sm:text-lg sm:font-normal sm:leading-[1.35] sm:text-primary">{value}</dd>
    </div>
  );
}

const heading: Record<OfferView, string> = {
  reply: "We'd love to have you on the team!",
  accepted: "You accepted your offer",
  declined: "You declined this offer",
  hired: "Welcome aboard!",
};

/**
 * The Offer card, by what has happened to the Offer: Sent asks for a reply; Accepted and Declined say when you answered;
 * Hired welcomes you. It always shows the complete terms, read from the shared database. Replies go through HRMS and only
 * work while `repliesEnabled` is on; Declined and Hired have nothing to act on.
 */
export function ApplicationOffer({ view, jobTitle, offer, referenceNumber = "", repliesEnabled = false, today = manilaToday() }: { view: OfferView; jobTitle: string | null; offer: Offer; referenceNumber?: string; repliesEnabled?: boolean; today?: string }) {
  const date = (value: string | null) => (value ? applicationDate.format(offerDate(value)) : null);
  const replyBy = date(offer.replyBy);
  const overdue = isOfferOverdue(offer, today);
  const role = jobTitle ? `the ${jobTitle} role` : "the role";
  const answeredOn = offer.repliedAt ? applicationDate.format(offer.repliedAt) : null;
  const terms: [string, string][] = [
    ["Monthly pay", formatMonthlyPay(offer.monthlyPay)],
    ["Start date", date(offer.startDate) ?? ""],
    ["Employment type", offer.employmentType],
    ["Schedule", offer.schedule],
    ["Probation", offer.probation],
    ["Reports to", offer.reportsTo],
    ["Branch", offer.branch],
  ];
  const Icon = view === "hired" ? PartyPopper : Heart;
  return (
    <section aria-labelledby="offer-heading" className="flex flex-col gap-4 border border-line bg-white px-5 pb-[22px] pt-6 sm:gap-6 sm:px-11 sm:pb-10 sm:pt-11">
      <div className="flex items-center gap-3 sm:gap-[18px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success sm:size-[52px]">
          <Icon aria-hidden className="size-5 sm:size-[22px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col sm:gap-1.5">
          <h2 id="offer-heading" className="font-serif text-lg leading-[1.35] text-primary sm:text-[28px] sm:leading-[1.25]">
            {heading[view]}
          </h2>
          <p className="hidden text-sm tracking-[0.35px] text-body sm:block">
            {view === "reply" && `Here's your offer for ${jobTitle ?? "the role"}.${replyBy ? ` Please reply by ${replyBy}.` : ""}`}
            {view === "accepted" && `Thank you! Please send the documents we need so we can prepare your first day as ${jobTitle ?? "part of the team"}.`}
            {view === "declined" && `Thank you for letting us know about ${role}. You can still apply for other open roles.`}
            {view === "hired" && `We're glad you're joining Bren Raphael's${jobTitle ? ` as ${jobTitle}` : ""}. Here are the terms you agreed to.`}
          </p>
        </div>
      </div>
      {(view === "accepted" || view === "declined") && (
        <p className=" bg-lavender-soft px-4 py-3 text-sm font-medium tracking-[0.35px] text-primary">
          {view === "accepted" ? "You accepted" : "You declined"}
          {answeredOn ? ` on ${answeredOn}` : " this offer"}
        </p>
      )}
      <dl className="flex flex-col bg-surface-soft sm:grid sm:grid-cols-2 sm:gap-3 sm:rounded-none sm:bg-transparent lg:grid-cols-4">
        {terms.map(([label, value]) => <Term key={label} label={label} value={value} />)}
        {replyBy && view === "reply" && (
          <div className="sm:hidden">
            <Term label="Reply by" value={`${replyBy}${overdue ? " · overdue" : ""}`} />
          </div>
        )}
      </dl>
      {view === "reply" && (
        <>
          {overdue && (
            <p role="status" className=" bg-warning-soft px-4 py-3 text-sm tracking-[0.35px] text-ink">
              The reply-by date of {replyBy} has passed. You can still reply: we&apos;ll be glad to hear from you.
            </p>
          )}
          <OfferReplyControls
            referenceNumber={referenceNumber}
            enabled={repliesEnabled}
            offer={{ monthlyPay: formatMonthlyPay(offer.monthlyPay), startDate: date(offer.startDate) ?? "", schedule: offer.schedule, replyBy: replyBy ? `${replyBy}${overdue ? " (passed)" : ""}` : null, jobTitle }}
          />
        </>
      )}
    </section>
  );
}
