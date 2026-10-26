"use server";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { liveInboxUrl, markAllInboxRead, markInboxRead } from "@/lib/notifications/inbox";

/** The address for the signed-in Customer's live Notifications line, or null when it cannot be issued; the page then just stays as loaded. */
export async function notificationsLiveUrl(): Promise<string | null> {
  const customer = await requireCustomer();
  try {
    return await liveInboxUrl(customer.userId);
  } catch (error) {
    console.error("Live Notifications pass could not be issued", error);
    return null;
  }
}

/** Marks one of the signed-in Customer's Notifications read; a failure is logged and the next load shows the truth. */
export async function markNotificationRead(id: string): Promise<void> {
  const customer = await requireCustomer();
  try {
    await markInboxRead(customer.userId, id);
  } catch (error) {
    console.error(`Notification ${id} could not be marked read`, error);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const customer = await requireCustomer();
  try {
    await markAllInboxRead(customer.userId);
  } catch (error) {
    console.error("Notifications could not be marked read", error);
  }
}
