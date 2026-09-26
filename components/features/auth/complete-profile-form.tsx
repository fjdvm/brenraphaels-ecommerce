"use client";

import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { submitCompleteProfile } from "@/app/(site)/complete-profile/actions";
import {
  DeliveryFields,
  NameFields,
  PreferenceFields,
  type FieldErrors,
} from "@/components/features/auth/customer-details-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  completeProfileFormValues,
  completeProfileSchema,
} from "@/lib/customer/complete-profile-schema";

type CompleteProfileFormProps = {
  email: string;
  defaults: { firstName: string; middleName: string; lastName: string };
};

export function CompleteProfileForm({ email, defaults }: CompleteProfileFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(undefined);

    const result = completeProfileSchema.safeParse(completeProfileFormValues(formData));
    const clientErrors = result.success ? {} : z.flattenError(result.error).fieldErrors;
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(event.currentTarget);
      return;
    }

    startTransition(async () => {
      // A successful save redirects to the profile, so only failures return.
      const outcome = await submitCompleteProfile(formData);
      setErrors(outcome.fieldErrors ?? {});
      setMessage(outcome.message);
    });
  }

  return (
    <Card className="mx-auto w-full max-w-lg rounded-2xl p-6 shadow-sm sm:p-8">
      <h1 className="font-serif text-3xl text-primary">Complete your profile</h1>
      <p className="mt-3 text-on-surface-variant">
        Your login for <strong>{email}</strong> is ready. We just need a few more
        details before you can use your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <NameFields errors={errors} defaults={defaults} />
        <DeliveryFields errors={errors} />
        <PreferenceFields errors={errors} />

        {message ? (
          <p className="text-sm text-red-700" role="alert">
            {message}
          </p>
        ) : null}

        <Button className="w-full" size="lg" disabled={pending} type="submit">
          {pending ? "Saving your details…" : "Save and continue"}
        </Button>
      </form>
    </Card>
  );
}

/** With client-side checks the browser's own validation is off, so move focus to the first error. */
function focusFirstInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() =>
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
