import { ArrowRight, Calendar, Play, Send, User } from "lucide-react";
import type { ReactNode } from "react";

import type { Interview } from "@/lib/careers/applications";

const TO_BE_CONFIRMED = "To be confirmed";
const zone = "Asia/Manila";
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: zone });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone });

function dayText(date: Date) {
  const part = (type: string) => dayFormat.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}

function timeText(startsAt: Date, endsAt?: Date) {
  const start = timeFormat.format(startsAt);
  if (!endsAt) return start;
  const end = timeFormat.format(endsAt);
  return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)} – ${end}` : `${start} – ${end}`;
}

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-surface-soft px-4 py-3 sm:w-[366px]">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs tracking-[0.35px] text-muted">{label}</dt>
        <dd className="break-words text-sm font-medium tracking-[0.35px] text-primary sm:text-base">{children}</dd>
      </div>
    </div>
  );
}

const checklist = ["Join 5 minutes early and test your camera and microphone.", "Find a quiet, well-lit place.", "Have a valid ID ready."];

/** The Interview-stage invitation. Every value comes from the optional Interview; nothing is invented, and gaps read "To be confirmed". The actions are placeholders until scheduling exists. */
export function ApplicationInterview({ interview }: { interview?: Interview }) {
  const { startsAt, endsAt, mode, where, meetingLink, address, interviewer } = interview ?? {};
  const kind = mode === "online" ? "an online interview" : mode === "in-person" ? "an in-person interview" : "an interview";
  const whereText = mode === "online" ? (where ? `Online · ${where}` : "Online") : (where ?? (mode === "in-person" ? "In person" : undefined));
  const when = startsAt ? `${dayText(startsAt)} · ${timeText(startsAt, endsAt)}` : undefined;
  const disabled = "cursor-not-allowed rounded-full px-[22px] py-3 text-base tracking-[0.45px] opacity-50";

  return (
    <section aria-labelledby="interview-heading" className="flex flex-col gap-5 sm:rounded-[40px] sm:border sm:border-line sm:bg-white sm:p-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-5 sm:gap-5 sm:rounded-none sm:border-0 sm:p-0">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
            <Calendar className="size-5" />
          </span>
          <h2 id="interview-heading" className="font-serif text-xl leading-[1.3] text-primary sm:text-[32px]">
            You’re invited to {kind}
          </h2>
        </div>
        <dl className="flex flex-col gap-3">
          <Detail icon={<Calendar className="size-4" />} label="Date and time">
            {when ?? TO_BE_CONFIRMED}
          </Detail>
          <Detail icon={<Play className="size-4" />} label="Where">
            {whereText ?? TO_BE_CONFIRMED}
          </Detail>
          {mode === "in-person" ? (
            <Detail icon={<Send className="size-4" />} label="Address">
              {address ?? TO_BE_CONFIRMED}
            </Detail>
          ) : (
            <Detail icon={<Send className="size-4" />} label="Meeting link">
              {meetingLink ? meetingLink.replace(/^https?:\/\//, "") : TO_BE_CONFIRMED}
            </Detail>
          )}
          <Detail icon={<User className="size-4" />} label="Interviewer">
            {interviewer ?? TO_BE_CONFIRMED}
          </Detail>
        </dl>
        <div className="flex flex-wrap items-center gap-3 sm:mt-2">
          <button type="button" disabled className={`${disabled} flex w-full items-center justify-center gap-2 bg-primary text-white sm:w-auto`}>
            Join interview <ArrowRight aria-hidden className="size-4" />
          </button>
          <button type="button" disabled className={`${disabled} flex-1 border border-primary text-primary sm:flex-none`}>
            Add to calendar
          </button>
          <button type="button" disabled className={`${disabled} flex-1 text-primary sm:ml-auto sm:flex-none sm:px-0`}>
            <span className="sm:hidden">Reschedule</span>
            <span className="hidden sm:inline">Need to reschedule?</span>
          </button>
        </div>
        <p className="text-xs tracking-[0.35px] text-muted">Joining, calendar and rescheduling are coming soon. We’ll email you any changes.</p>
      </div>
      <div className="flex flex-col gap-2.5 rounded-[28px] bg-lavender/60 p-5 sm:rounded-3xl sm:p-6">
        <h3 className="text-sm font-medium tracking-[0.35px] text-primary">Before your interview</h3>
        <ul className="flex flex-col gap-2 text-sm tracking-[0.35px] text-body">
          {checklist.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden>•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
