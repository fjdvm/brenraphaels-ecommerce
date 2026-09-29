"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createTicketStore, ticketInput } from "@/lib/support/tickets";
import { ticketMessageInput } from "@/lib/support/ticket-message";
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
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const customer = await requireCustomer();
  try {
    await createTicketStore(getDatabase()).open(customer.userId, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "Order was not found.") {
      return { fieldErrors: { orderId: ["Choose one of your Orders"] } };
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
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const customer = await requireCustomer();
  try {
    await createTicketStore(getDatabase()).addMessage(ticketId, customer.userId, parsed.data);
  } catch (error) {
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
