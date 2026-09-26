"use client";

import { useActionState } from "react";

import {
  sendContactMessage,
  type ContactFormState,
} from "@/app/(site)/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  commentMaximumLength,
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

export function ContactForm() {
  const [state, action, pending] = useActionState(
    sendContactMessage,
    initialContactFormState,
  );

  if (state.sent) {
    return (
      <p role="status" className="font-semibold text-primary">
        Thank you! Your message has been sent. We&apos;ll get back to you soon.
      </p>
    );
  }

  const errors = state.fieldErrors;
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={nameMaximumLength}
        />
        <FieldError messages={errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" required>
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
          required
        />
        <FieldError messages={errors?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={phoneMaximumLength}
        />
        <FieldError messages={errors?.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="comment" required>
          Comment
        </Label>
        <textarea
          id="comment"
          name="comment"
          rows={6}
          maxLength={commentMaximumLength}
          required
          className="flex w-full border border-input bg-white px-3 py-2 text-base outline-none sm:text-sm placeholder:text-on-surface-variant focus:ring-2 focus:ring-ring"
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
      <Button size="lg" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send us message"}
      </Button>
    </form>
  );
}
