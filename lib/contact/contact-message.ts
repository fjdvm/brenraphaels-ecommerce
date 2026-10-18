import { z } from "zod";

import { emailField, multilineTextField, optionalTextField } from "../validators/fields";

export const nameMaximumLength = 100;
export const phoneMaximumLength = 30;
export const commentMaximumLength = 2_000;

export const contactTopics = [
  "General inquiry",
  "Order or delivery",
  "Bulk order",
  "Feedback",
] as const;
export const defaultContactTopic = contactTopics[0];

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
  topic: z.enum(contactTopics, { error: "Choose a topic" }),
  comment: multilineTextField("Enter your message", {
    max: commentMaximumLength,
    pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\s]+$/u,
    patternMessage: "Enter your message",
  }),
});

export type ContactMessage = z.output<typeof contactMessageSchema>;

export type ContactMessageInput = {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
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
    topic: input.topic || defaultContactTopic,
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
