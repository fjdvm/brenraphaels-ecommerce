"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendTicketCreatedEmail } from "@/lib/email/ticket-created-email";
import { publishTicketEvent } from "@/lib/support/ticket-events";
import { createTicketStore, openTicketAndNotify, ticketInput } from "@/lib/support/tickets";
import { ticketMessageInput } from "@/lib/support/ticket-message";
import { uploadTicketAttachment, validateTicketAttachment } from "@/lib/support/ticket-attachment";
import { positiveIntegerField } from "@/lib/validators/fields";

export type CreateTicketState = {
  created?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

export type SendMessageState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  sent?: boolean;
};

export type TicketStatusState = {
  closed?: boolean;
  message?: string;
  reopened?: boolean;
};

const ticketStore = () => createTicketStore(getDatabase(), { publish: publishTicketEvent });

const attachmentUnavailable = "Image uploads aren't available right now. Send your Message without one, or try again later.";

/** Reads the optional single image from the form; `error` is a clear message for the form. */
function readAttachment(formData: FormData): { file?: File; error?: string } {
  const value = formData.get("attachment");
  if (!(value instanceof File) || (value.size === 0 && value.name === "")) return {};
  try {
    validateTicketAttachment(value);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't use that image." };
  }
  return { file: value };
}

function uploadAttachment(file: File, ticketId: number) {
  const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error(attachmentUnavailable);
  return uploadTicketAttachment(file, {
    ticketId,
    put: (pathname, body, options) => put(pathname, body, { ...options, token }),
  });
}

/** Opens a Ticket for the signed-in Customer, then refreshes their Support list. */
export async function createTicket(
  _previousState: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  void _previousState;
  const parsed = ticketInput.safeParse({
    subject: formData.get("subject"),
    category: formData.get("category"),
    orderId: formData.get("orderId"),
    body: formData.get("body"),
  });
  const attachment = readAttachment(formData);
  if (!parsed.success || attachment.error) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(attachment.error ? { attachment: [attachment.error] } : {}),
      },
    };
  }

  const customer = await requireCustomer();
  const file = attachment.file;
  try {
    await openTicketAndNotify(
      customer.userId,
      customer.email,
      parsed.data,
      { ticketStore: ticketStore(), mailer: { send: sendTicketCreatedEmail } },
      file ? (ticketId) => uploadAttachment(file, ticketId) : undefined,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Order was not found.") {
      return { fieldErrors: { orderId: ["Choose one of your Orders"] } };
    }
    if (error instanceof Error && error.message === attachmentUnavailable) {
      return { fieldErrors: { attachment: [attachmentUnavailable] } };
    }
    console.error("Opening Ticket failed", error);
    return { message: "We couldn't open your Ticket. Please try again." };
  }

  revalidatePath("/support");
  return { created: true };
}

/** Appends a Customer Message to one of their Tickets and refreshes its thread. */
export async function sendMessage(
  ticketId: number,
  _previousState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  void _previousState;
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) {
    return { message: "We couldn't send your Message. Please try again." };
  }
  const parsed = ticketMessageInput.safeParse({ body: formData.get("body") });
  const attachment = readAttachment(formData);
  if (!parsed.success || attachment.error) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(attachment.error ? { attachment: [attachment.error] } : {}),
      },
    };
  }

  const customer = await requireCustomer();
  try {
    const store = ticketStore();
    if (!(await store.get(ticketId, customer.userId))) throw new Error("Ticket was not found.");
    const attachmentPathname = attachment.file ? await uploadAttachment(attachment.file, ticketId) : undefined;
    await store.addMessage(ticketId, customer.userId, parsed.data, attachmentPathname);
  } catch (error) {
    if (error instanceof Error && error.message === attachmentUnavailable) {
      return { fieldErrors: { attachment: [attachmentUnavailable] } };
    }
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    console.error("Sending Ticket Message failed", error);
    return { message: "We couldn't send your Message. Please try again." };
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { sent: true };
}

/** Closes a Customer-owned Ticket and refreshes its detail and list entries. */
export async function closeTicket(ticketId: number): Promise<TicketStatusState> {
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) {
    return { message: "We couldn't close this Ticket. Please try again." };
  }

  const customer = await requireCustomer();
  try {
    await createTicketStore(getDatabase()).close(ticketId, customer.userId);
  } catch (error) {
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    console.error("Closing Ticket failed", error);
    return { message: "We couldn't close this Ticket. Please try again." };
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { closed: true };
}

/** Reopens a Customer-owned Ticket and refreshes its detail and list entries. */
export async function reopenTicket(ticketId: number): Promise<TicketStatusState> {
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) {
    return { message: "We couldn't reopen this Ticket. Please try again." };
  }

  const customer = await requireCustomer();
  try {
    await createTicketStore(getDatabase()).reopen(ticketId, customer.userId);
  } catch (error) {
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    console.error("Reopening Ticket failed", error);
    return { message: "We couldn't reopen this Ticket. Please try again." };
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { reopened: true };
}
