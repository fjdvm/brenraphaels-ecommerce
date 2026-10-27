"use server";

import { revalidatePath } from "next/cache";

import { markAllApplicantInboxRead, markApplicantInboxRead } from "@/lib/careers/inbox";

/** Marks one of the signed-in Applicant's Notifications read; a failure is logged and the next load shows the truth. */
export async function markApplicantNotificationRead(id: string): Promise<void> {
  try {
    await markApplicantInboxRead(id);
  } catch (error) {
    console.error(`Notification ${id} could not be marked read`, error);
  }
  revalidatePath("/careers", "layout");
}

export async function markAllApplicantNotificationsRead(): Promise<void> {
  try {
    await markAllApplicantInboxRead();
  } catch (error) {
    console.error("Notifications could not be marked read", error);
  }
  revalidatePath("/careers", "layout");
}
