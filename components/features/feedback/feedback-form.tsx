"use client";

import { MessageSquarePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { feedbackReportSchema } from "@/lib/feedback/report";
import { feedbackClientEnvironment } from "@/lib/feedback/client-environment";
import { useFeedbackButtonTheme } from "./use-feedback-button-theme";

type Fields = {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  honeypot: string;
};

const emptyFields: Fields = {
  title: "",
  description: "",
  stepsToReproduce: "",
  expectedResult: "",
  actualResult: "",
  honeypot: "",
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-700">{message}</p> : null;
}

/** Lets any visitor report a problem without exposing the GitHub credential. */
export function FeedbackForm() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasDarkBackground = useFeedbackButtonTheme(buttonRef);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string>();
  const [rateLimited, setRateLimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setRateLimited(false);
    const parsed = feedbackReportSchema.safeParse({ ...fields, environment: feedbackClientEnvironment() });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result: { message?: string; fieldErrors?: Record<string, string[] | undefined>; rateLimited?: boolean } = await response.json();
      if (!response.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setRateLimited(Boolean(result.rateLimited));
        setMessage(result.message ?? "We couldn't submit your feedback. Please try again.");
        return;
      }
      setFields(emptyFields);
      setMessage("Thank you — your feedback has been submitted.");
    } catch {
      setMessage("We couldn't submit your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hasDarkBackground ? "bg-white text-primary hover:bg-primary-fixed" : "bg-primary text-white hover:bg-primary-container"}`}
      >
        <MessageSquarePlus size={18} aria-hidden="true" />
        Feedback
      </button>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogTitle className="font-serif text-3xl text-primary">Send feedback</DialogTitle>
        <DialogDescription className="mt-2 leading-6 text-on-surface-variant">
          Tell us what went wrong or what we could improve.
        </DialogDescription>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div aria-hidden="true" className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
            <label htmlFor="feedback-website">Website</label>
            <input
              id="feedback-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={fields.honeypot}
              onChange={(event) => update("honeypot", event.target.value)}
            />
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-on-surface" htmlFor="feedback-title">
            Title
            <input id="feedback-title" maxLength={120} value={fields.title} onChange={(event) => update("title", event.target.value)} className="h-11 border border-input bg-white px-3 text-base outline-none focus:ring-2 focus:ring-ring" aria-invalid={Boolean(fieldErrors.title)} />
            <FieldError message={fieldErrors.title?.[0]} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-on-surface" htmlFor="feedback-description">
            Description
            <textarea id="feedback-description" rows={5} maxLength={2_000} value={fields.description} onChange={(event) => update("description", event.target.value)} className="w-full border border-input bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring" aria-invalid={Boolean(fieldErrors.description)} />
            <FieldError message={fieldErrors.description?.[0]} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-on-surface" htmlFor="feedback-steps">
            Steps to reproduce (optional)
            <textarea id="feedback-steps" rows={3} maxLength={2_000} value={fields.stepsToReproduce} onChange={(event) => update("stepsToReproduce", event.target.value)} className="w-full border border-input bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring" aria-invalid={Boolean(fieldErrors.stepsToReproduce)} />
            <FieldError message={fieldErrors.stepsToReproduce?.[0]} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-on-surface" htmlFor="feedback-expected">
            Expected result (optional)
            <textarea id="feedback-expected" rows={3} maxLength={2_000} value={fields.expectedResult} onChange={(event) => update("expectedResult", event.target.value)} className="w-full border border-input bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring" aria-invalid={Boolean(fieldErrors.expectedResult)} />
            <FieldError message={fieldErrors.expectedResult?.[0]} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-on-surface" htmlFor="feedback-actual">
            Actual result (optional)
            <textarea id="feedback-actual" rows={3} maxLength={2_000} value={fields.actualResult} onChange={(event) => update("actualResult", event.target.value)} className="w-full border border-input bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring" aria-invalid={Boolean(fieldErrors.actualResult)} />
            <FieldError message={fieldErrors.actualResult?.[0]} />
          </label>
          {message && (
            <p role="status" className={`text-sm ${rateLimited ? "font-semibold text-amber-700" : "text-on-surface-variant"}`}>
              {message}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="justify-self-end">
            {submitting ? "Submitting…" : "Submit feedback"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
