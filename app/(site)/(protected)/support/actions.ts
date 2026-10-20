"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendTicketCompletedEmail } from "@/lib/email/ticket-completed-email";
import { sendTicketCreatedEmail } from "@/lib/email/ticket-created-email";
import { liveConversationUrl } from "@/lib/support/live";
import { completedTicketError, completeTicketAndNotify, createTicketStore, openTicketAndNotify, ticketInput } from "@/lib/support/tickets";
import { ticketMessageInput } from "@/lib/support/ticket-message";
import { uploadTicketAttachment, validateTicketAttachment } from "@/lib/support/ticket-attachment";
import { positiveIntegerField } from "@/lib/validators/fields";

export type CreateTicketState = {
  created?: boolean;
  ticketId?: number;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};

export type SendMessageState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  sent?: boolean;
  /** The saved Message's id, which the live relay echoes so every open tab can match its copy. */
  messageId?: number;
};

export type TicketStatusState = {
  completed?: boolean;
  message?: string;
  reopened?: boolean;
};

const ticketStore = () => createTicketStore(getDatabase());

const completedMessage = "This Ticket is completed. Open a new Ticket if you need more help.";

const attachmentUnavailable = "Image uploads aren't available right now. Send your Message without one, or try again later.";

/**
 * Reads the optional single image from the form; `error` is a clear message for the form.
 * An untouched file input can arrive as a zero-byte File with a non-empty name, so an empty File means no image.
 */
function readAttachment(formData: FormData): { file?: File; error?: string } {
  const value = formData.get("attachment");
  if (!(value instanceof File) || value.size === 0) return {};
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
  let opened: Awaited<ReturnType<typeof openTicketAndNotify>>;
  try {
    opened = await openTicketAndNotify(
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
  revalidatePath("/support", "layout");
  return { created: true, ticketId: opened.id };
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
  let saved: { messageId: number } | undefined;
  try {
    const store = ticketStore();
    const ticket = await store.get(ticketId, customer.userId);
    if (!ticket) throw new Error("Ticket was not found.");
    if (ticket.status === "completed") throw new Error(completedTicketError);
    const attachmentPathname = attachment.file ? await uploadAttachment(attachment.file, ticketId) : undefined;
    saved = await store.addMessage(ticketId, customer.userId, parsed.data, attachmentPathname);
  } catch (error) {
    if (error instanceof Error && error.message === attachmentUnavailable) {
      return { fieldErrors: { attachment: [attachmentUnavailable] } };
    }
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    if (error instanceof Error && error.message === completedTicketError) {
      return { message: completedMessage };
    }
    console.error("Sending Ticket Message failed", error);
    return { message: "We couldn't send your Message. Please try again." };
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  revalidatePath("/support", "layout");
  return { sent: true, messageId: saved?.messageId };
}

/**
 * Where the Customer's browser joins their Ticket's Conversation, or null when it cannot: the Ticket is
 * not theirs or the gateway is unreachable. The thread then simply is not live; Messages still save.
 */
export async function ticketLiveUrl(ticketId: number): Promise<string | null> {
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) return null;

  const customer = await requireCustomer();
  try {
    if (!(await ticketStore().get(ticketId, customer.userId))) return null;

    return await liveConversationUrl(ticketId, customer.userId);
  } catch (error) {
    console.error("Live ticket could not be issued", error);
    return null;
  }
}

function refreshTicket(ticketId: number) {
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  revalidatePath("/support", "layout");
}

/** Completes a Customer-owned Ticket, thanks the Customer by email and refreshes its detail and list entries. */
export async function completeTicket(ticketId: number): Promise<TicketStatusState> {
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) {
    return { message: "We couldn't complete this Ticket. Please try again." };
  }

  const customer = await requireCustomer();
  try {
    await completeTicketAndNotify(ticketId, customer.userId, customer.email, {
      ticketStore: ticketStore(),
      mailer: { send: sendTicketCompletedEmail },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    if (error instanceof Error && error.message === completedTicketError) {
      refreshTicket(ticketId);
      return { message: completedMessage };
    }
    console.error("Completing Ticket failed", error);
    return { message: "We couldn't complete this Ticket. Please try again." };
  }

  refreshTicket(ticketId);
  return { completed: true };
}

/** Sends a Resolved Customer-owned Ticket back to Open because it is not fixed. */
export async function reportTicketNotFixed(ticketId: number): Promise<TicketStatusState> {
  if (!positiveIntegerField("Ticket ID").safeParse(String(ticketId)).success) {
    return { message: "We couldn't reopen this Ticket. Please try again." };
  }

  const customer = await requireCustomer();
  try {
    await ticketStore().reportNotFixed(ticketId, customer.userId);
  } catch (error) {
    if (error instanceof Error && error.message === "Ticket was not found.") {
      return { message: "This Ticket is no longer available." };
    }
    if (error instanceof Error && error.message === completedTicketError) {
      refreshTicket(ticketId);
      return { message: completedMessage };
    }
    if (error instanceof Error && error.message === "Ticket is not resolved.") {
      refreshTicket(ticketId);
      return { message: "This Ticket isn't waiting for your confirmation." };
    }
    console.error("Reopening Ticket failed", error);
    return { message: "We couldn't reopen this Ticket. Please try again." };
  }

  refreshTicket(ticketId);
  return { reopened: true };
}
