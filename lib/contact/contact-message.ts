import { z } from "zod";

import { emailField, optionalTextField } from "../validators/fields";

export const nameMaximumLength = 100;
export const phoneMaximumLength = 30;
export const commentMaximumLength = 2_000;

const invisibleCharacters = /[^\P{Cc}\n]|\p{Cf}/gu;

/** Keeps the line breaks people type, but no invisible characters or long runs of blank lines. */
function cleanComment(value: string) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(invisibleCharacters, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const contactMessageSchema = z.object({
  name: optionalTextField({
    max: nameMaximumLength,
    pattern: /^.+$/u,
    patternMessage: "Enter your name",
  }),
  email: emailField,
  phone: optionalTextField({
    max: phoneMaximumLength,
    pattern: /^[+\d\s().-]+$/,
    patternMessage: "Enter a valid phone number",
  }),
  comment: z
    .string({ error: "Enter your message" })
    .max(10_000, `Must be ${commentMaximumLength} characters or fewer`)
    .transform(cleanComment)
    .pipe(
      z
        .string()
        .min(1, "Enter your message")
        .max(commentMaximumLength, `Must be ${commentMaximumLength} characters or fewer`),
    ),
});

export type ContactMessage = z.output<typeof contactMessageSchema>;

export type ContactMessageInput = {
  name?: string;
  email?: string;
  phone?: string;
  comment?: string;
  /** A field real visitors never see; only bots fill it in. */
  website?: string;
};

export type ContactMailer = {
  send(message: ContactMessage): Promise<void>;
};

export type ContactMessageResult =
  | { status: "sent" }
  | { status: "invalid"; fieldErrors: Record<string, string[] | undefined> }
  | { status: "failed" };

export async function submitContactMessage(
  input: ContactMessageInput,
  dependencies: { mailer: ContactMailer },
): Promise<ContactMessageResult> {
  // Bots fill in every field, so a filled hidden one is answered as a success
  // to give them nothing to learn from, and nothing is sent.
  if (input.website) {
    return { status: "sent" };
  }

  const parsed = contactMessageSchema.safeParse({
    name: input.name,
    email: input.email ?? "",
    phone: input.phone,
    comment: input.comment ?? "",
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    await dependencies.mailer.send(parsed.data);
  } catch (error) {
    console.error("Contact message could not be sent", error);
    return { status: "failed" };
  }
  return { status: "sent" };
}
