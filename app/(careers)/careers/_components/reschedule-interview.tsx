"use client";

import { Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { requestRescheduleAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { DatePicker, manilaToday } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { rescheduleComingSoon } from "@/lib/careers/interview-reschedule";

import { runWithToast } from "./action-toast";

const times = [
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
];

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function dayText(date: string) {
  const parts = Object.fromEntries(dayFormat.formatToParts(new Date(`${date}T00:00:00Z`)).map(({ type, value }) => [type, value]));
  return `${parts.weekday}, ${parts.day} ${parts.month}`;
}
const primary = "rounded-full bg-primary px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] text-primary";

/**
 * "Need to reschedule?": a request for a new Interview time, not a booking. While the offer-replies flag is off the control is visible,
 * disabled, carries the Coming soon note and makes no request. A bottom sheet on mobile, a dialog on desktop.
 */
export function RescheduleInterview({ referenceNumber, enabled, today }: { referenceNumber: string; enabled: boolean; today?: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const min = today ?? manilaToday();

  function close(next: boolean) {
    if (next) return;
    setOpen(false);
    setDate("");
    setTime("");
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !date || !time) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    // The card carries progress and the result, so the dialog closes first; an open dialog would also block the card's Retry.
    close(false);
    try {
      await runWithToast({
        loading: "Sending your request…",
        success: "Request sent",
        error: "We couldn't send your request. Try again.",
        task: () => requestRescheduleAction(formData),
      });
    } finally {
      setPending(false);
    }
  }

  const summary = date && time ? `${dayText(date)} · ${times.find((slot) => slot.value === time)?.label}` : "Choose a day and a time";
  return (
    <>
      <div className="flex flex-col sm:ml-auto sm:items-end">
        <button
          type="button"
          disabled={!enabled || pending}
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center rounded-full border border-primary px-[22px] py-3 text-base tracking-[0.45px] text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:border-0 sm:px-0 sm:py-1.5 sm:text-sm sm:font-medium"
        >
          <span className="sm:hidden">Reschedule</span>
          <span className="hidden sm:inline">Need to reschedule?</span>
        </button>
        {enabled ? null : <span className="mt-1 text-xs tracking-[0.35px] text-muted">{rescheduleComingSoon}</span>}
      </div>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          aria-describedby={undefined}
          className="bottom-0 left-0 top-auto max-h-[92vh] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-[32px] border-0 p-0 shadow-[0_-8px_16px_rgba(43,26,69,0.2)] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[620px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px]"
        >
          <form onSubmit={send}>
            <input type="hidden" name="referenceNumber" value={referenceNumber} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-sm bg-line sm:hidden" />
            <div className="flex items-start gap-3 pb-4 pl-5 pr-4 pt-3 sm:pl-8 sm:pr-6 sm:pt-7">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <DialogTitle className="font-serif text-[22px] leading-[1.3] text-primary">Request a new interview time</DialogTitle>
                <DialogDescription className="text-sm leading-[1.5] tracking-[0.35px] text-body">Pick a time that works for you. We&apos;ll confirm by email.</DialogDescription>
              </div>
              <button type="button" aria-label="Close" onClick={() => close(false)} className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
                <X aria-hidden className="size-[18px]" />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-6 pt-2 sm:px-8">
              <p className="text-[13px] font-medium tracking-[0.35px] text-ink">Choose a day</p>
              <DatePicker value={date} onChange={setDate} min={min} />
              <p className="text-[13px] font-medium tracking-[0.35px] text-ink">Choose a time</p>
              <div role="group" aria-label="Choose a time" className="flex flex-wrap gap-2">
                {times.map((slot) => {
                  const selected = slot.value === time;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTime(slot.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-2.5 pl-3.5 pr-4 text-sm font-medium tracking-[0.35px] ${selected ? "border-primary bg-lavender text-primary" : "border-line bg-white text-ink"}`}
                    >
                      {selected ? <Check aria-hidden className="size-3.5" /> : null}
                      {slot.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex flex-col gap-2 text-[13px] font-medium tracking-[0.35px] text-ink">
                Note (optional)
                <textarea name="note" maxLength={500} rows={3} className="rounded-[3px] border border-line bg-white px-4 py-3.5 text-sm font-normal text-ink" />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-5 pb-7 pt-[18px] sm:px-8 sm:pb-6">
              <p className="min-w-full flex-1 text-xs tracking-[0.35px] text-muted sm:min-w-0">{summary}</p>
              <button type="button" onClick={() => close(false)} className={secondary}>
                Cancel
              </button>
              <button type="submit" disabled={!date || !time || pending} className={primary}>
                Send request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
