"use server";

import { revalidatePath } from "next/cache";

import { liveApplicantInboxUrl, markAllApplicantInboxRead, markApplicantInboxRead } from "@/lib/careers/inbox";

export type MarkReadOutcome = { ok: true } | { ok: false; message: string };

/** Marks one of the signed-in Applicant's Notifications read; a failure is logged and reported so the card can offer Retry. */
export async function markApplicantNotificationRead(id: string): Promise<MarkReadOutcome> {
  try {
    await markApplicantInboxRead(id);
    return { ok: true };
  } catch (error) {
    console.error(`Notification ${id} could not be marked read`, error);
    return { ok: false, message: "We couldn't mark that notification as read. Try again." };
  } finally {
    revalidatePath("/careers", "layout");
  }
}

export async function markAllApplicantNotificationsRead(): Promise<MarkReadOutcome> {
  try {
    await markAllApplicantInboxRead();
    return { ok: true };
  } catch (error) {
    console.error("Notifications could not be marked read", error);
    return { ok: false, message: "We couldn't mark your notifications as read. Try again." };
  } finally {
    revalidatePath("/careers", "layout");
  }
}

/** The address for the signed-in Applicant's live Notifications line, or null when it cannot be issued; the page then just stays as loaded. */
export async function applicantNotificationsLiveUrl(): Promise<string | null> {
  try {
    return await liveApplicantInboxUrl();
  } catch (error) {
    console.error("Live Applicant Notifications pass could not be issued", error);
    return null;
  }
}
