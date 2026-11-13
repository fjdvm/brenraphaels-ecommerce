import { Mail } from "lucide-react";

/** Messages has no source yet, so it says so rather than inventing a thread. */
export function ApplicationMessages() {
  return (
    <section aria-labelledby="messages-heading" className="flex flex-col gap-1 border border-line bg-white px-5 pb-5 pt-[22px] sm:px-7 sm:pb-6 sm:pt-8">
      <h2 id="messages-heading" className="font-serif text-lg leading-[1.35] text-primary sm:text-[22px]">
        Messages
      </h2>
      <p className="text-xs tracking-[0.35px] text-muted">Emails we send you also appear here.</p>
      <div className="mt-3 flex items-center gap-3.5 border-t border-line pt-4">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-muted">
          <Mail className="size-4" />
        </span>
        <p className="text-sm tracking-[0.35px] text-body">No messages yet</p>
      </div>
    </section>
  );
}

export function ApplicationHelp() {
  return (
    <section aria-labelledby="help-heading" className="flex flex-col items-start gap-3 bg-[#3f2b5f] px-7 py-8">
      <h2 id="help-heading" className="font-serif text-[22px] leading-[1.3] text-white">
        Questions?
      </h2>
      <p className="text-sm leading-[1.5] tracking-[0.35px] text-lavender">Reply to any of our emails, or message the hiring team at careers@brenraphaels.ph.</p>
      <a href="mailto:careers@brenraphaels.ph" className="rounded-full bg-white px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] text-primary">
        Message the team
      </a>
    </section>
  );
}
