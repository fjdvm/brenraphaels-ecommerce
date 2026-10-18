"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  sendContactMessage,
  type ContactFormState,
} from "@/app/(site)/contact/actions";
import { SectionHeading } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  commentMaximumLength,
  contactTopics,
  defaultContactTopic,
  nameMaximumLength,
  phoneMaximumLength,
} from "@/lib/contact/contact-message";
import { emailMaximumLength } from "@/lib/validators/fields";

const initialContactFormState: ContactFormState = {};

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.[0] ? (
    <p className="text-sm text-red-700" role="alert">
      {messages[0]}
    </p>
  ) : null;
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-6 rounded-[40px] border border-line bg-white p-6 sm:p-[50px]">
      <SectionHeading eyebrow="Send us a message" title="How can we help?" />
      {children}
    </div>
  );
}

export function ContactForm() {
  const [state, action, pending] = useActionState(
    sendContactMessage,
    initialContactFormState,
  );

  if (state.sent) {
    return (
      <FormCard>
        <p role="status" className="leading-[1.6] tracking-[0.35px] text-body">
          Thank you! Your message has been sent. We&apos;ll get back to you soon.
        </p>
      </FormCard>
    );
  }

  const errors = state.fieldErrors;
  return (
    <FormCard>
      <form action={action} className="flex flex-1 flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name" className={fieldLabelClass}>
              Name
            </Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={nameMaximumLength}
              placeholder="Your full name"
              className={fieldClass}
            />
            <FieldError messages={errors?.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" required className={fieldLabelClass}>
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={emailMaximumLength}
              placeholder="you@example.com"
              className={fieldClass}
              required
            />
            <FieldError messages={errors?.email} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone" className={fieldLabelClass}>
              Phone
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={phoneMaximumLength}
              placeholder="09XX XXX XXXX"
              className={fieldClass}
            />
            <FieldError messages={errors?.phone} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic" className={fieldLabelClass}>
              Topic
            </Label>
            <Select
              id="topic"
              name="topic"
              defaultValue={defaultContactTopic}
              className={fieldClass}
            >
              {contactTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </Select>
            <FieldError messages={errors?.topic} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="comment" required className={fieldLabelClass}>
            Message
          </Label>
          <textarea
            id="comment"
            name="comment"
            rows={5}
            maxLength={commentMaximumLength}
            placeholder="Tell us what's on your mind…"
            required
            className="flex min-h-32 w-full rounded-[3px] border border-line bg-white px-4 py-3.5 text-sm tracking-[0.35px] outline-none placeholder:text-muted focus:ring-2 focus:ring-ring"
          />
          <FieldError messages={errors?.comment} />
        </div>
        {/* Hidden from people; bots that fill in every field give themselves away. */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {state.message ? (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-[30px]">
          <p className="flex items-center gap-2.5 text-xs tracking-[0.35px] text-muted">
            <MessageCircle aria-hidden className="size-[18px] shrink-0" />
            <span>
              Order issue?{" "}
              <Link className="underline" href="/support">
                Use Support tickets
              </Link>{" "}
              for faster help.
            </span>
          </p>
          <Button variant="pill" size="pill-lg" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send message"}
            {pending ? null : <ArrowRight aria-hidden className="size-5" />}
          </Button>
        </div>
      </form>
    </FormCard>
  );
}
