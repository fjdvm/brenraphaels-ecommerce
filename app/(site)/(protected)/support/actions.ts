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
  return { sent: true };
}
