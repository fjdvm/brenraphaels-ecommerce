"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendTicketCompletedEmail } from "@/lib/email/ticket-completed-email";
import { sendTicketCreatedEmail } from "@/lib/email/ticket-created-email";
import { liveConversationUrl } from "@/lib/support/live";
import { completedTicketError, completeTicketAndNotify, createTicketStore, openTicketAndNotify, ticketInput } from "@/lib/support/tickets";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
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

const ticketFiles = () => gatewayTicketFiles();

/** Stores the image in file-storage; any failure reads as "uploads aren't available" so the form can say so. */
async function uploadAttachment(file: File): Promise<string> {
  try {
    return await uploadTicketAttachment(file, ticketFiles());
  } catch (error) {
    console.error("Ticket image could not be stored in file-storage", error);
    throw new Error(attachmentUnavailable);
  }
}

/** The Message is already saved with its file id; the Link only helps file-storage find a record's Files. */
async function linkAttachment(fileId: string, messageId: number) {
  try {
    await ticketFiles().linkToMessage(fileId, messageId);
  } catch (error) {
    console.error("Ticket image was saved but could not be Linked to its Message", error);
  }
}

async function discardAttachment(fileId: string) {
  try {
    await ticketFiles().remove(fileId);
  } catch (error) {
    console.error("An image for an unsaved Message could not be removed from file-storage", error);
  }
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
  let fileId: string | undefined;
  let opened: Awaited<ReturnType<typeof openTicketAndNotify>>;
  try {
    opened = await openTicketAndNotify(
      customer.userId,
      customer.email,
      parsed.data,
      { ticketStore: ticketStore(), mailer: { send: sendTicketCreatedEmail } },
      file ? async () => (fileId = await uploadAttachment(file)) : undefined,
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

  if (fileId && opened.messages[0]) await linkAttachment(fileId, opened.messages[0].id);

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
  let fileId: string | undefined;
  try {
    const store = ticketStore();
    const ticket = await store.get(ticketId, customer.userId);
    if (!ticket) throw new Error("Ticket was not found.");
    if (ticket.status === "completed") throw new Error(completedTicketError);
    fileId = attachment.file ? await uploadAttachment(attachment.file) : undefined;
    saved = await store.addMessage(ticketId, customer.userId, parsed.data, fileId);
  } catch (error) {
    if (fileId && !saved) await discardAttachment(fileId);
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

  if (fileId && saved) await linkAttachment(fileId, saved.messageId);

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
