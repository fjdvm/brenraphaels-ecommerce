"use server";

import { submitContactMessage } from "@/lib/contact/contact-message";
import { sendContactMessageEmail } from "@/lib/email/contact-message-email";

export type ContactFormState = {
  sent?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function sendContactMessage(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const result = await submitContactMessage(
    {
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      comment: text(formData, "comment"),
      website: text(formData, "website"),
    },
    { mailer: { send: sendContactMessageEmail } },
  );

  if (result.status === "invalid") {
    return { fieldErrors: result.fieldErrors };
  }
  if (result.status === "failed") {
    return {
      message:
        "We couldn't send your message. Please try again, or email us directly.",
    };
  }
  return { sent: true };
}
