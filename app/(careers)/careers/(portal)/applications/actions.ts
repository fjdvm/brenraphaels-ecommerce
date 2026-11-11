"use server";

import { revalidatePath } from "next/cache";

import { createApplicationStore, withdrawApplication } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { requestReschedule, stubInterviewRescheduleGateway, type RescheduleOutcome } from "@/lib/careers/interview-reschedule";
import { offerRepliesEnabled, replyToOffer, stubOfferReplyGateway, type OfferReplyOutcome } from "@/lib/careers/offer-reply";
import { applicationReferenceNumberField, offerDeclineReasonField, rescheduleDateField, rescheduleNoteField, rescheduleTimeField } from "@/lib/validators/application";

export type WithdrawOutcome = { ok: true } | { ok: false; message: string };

/** Withdraws the signed-in Applicant's Application; says why when it could not, so the card can offer Retry. */
export async function withdrawApplicationAction(formData: FormData): Promise<WithdrawOutcome> {
  const applicant = await careersSession();
  if (!applicant) return { ok: false, message: "Please sign in to withdraw an application." };
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!referenceNumber.success) return { ok: false, message: "Choose a valid Application to withdraw." };
  try {
    await withdrawApplication(referenceNumber.data, createApplicationStore(getCareersDatabase()), applicant.userId);
    return { ok: true };
  } catch (error) {
    console.error("Application could not be withdrawn", error);
    return { ok: false, message: "We couldn't withdraw your application. It may have already moved on." };
  } finally {
    revalidatePath("/careers/applications");
  }
}

async function reply(formData: FormData, kind: "accept" | "decline"): Promise<OfferReplyOutcome> {
  const applicant = await careersSession();
  if (!applicant) return { ok: false, message: "Please sign in to reply to your offer." };
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!referenceNumber.success) return { ok: false, message: "Choose a valid Application to reply to." };
  const target = { applicantId: applicant.userId, referenceNumber: referenceNumber.data };
  if (kind === "accept") return replyToOffer({ kind, ...target }, { enabled: offerRepliesEnabled(), gateway: stubOfferReplyGateway });
  const reason = offerDeclineReasonField.safeParse(formData.get("reason"));
  if (!reason.success) return { ok: false, message: reason.error.issues[0]?.message ?? "Check your reason and try again." };
  return replyToOffer({ kind, reason: reason.data, ...target }, { enabled: offerRepliesEnabled(), gateway: stubOfferReplyGateway });
}

/** Accepts the signed-in Applicant's Offer. Does nothing while the offer-replies flag is off. */
export async function acceptOfferAction(formData: FormData): Promise<OfferReplyOutcome> {
  const outcome = await reply(formData, "accept");
  if (outcome.ok) revalidatePath("/careers/applications");
  return outcome;
}

/** Declines the signed-in Applicant's Offer, with an optional reason. Does nothing while the flag is off. */
export async function declineOfferAction(formData: FormData): Promise<OfferReplyOutcome> {
  const outcome = await reply(formData, "decline");
  if (outcome.ok) revalidatePath("/careers/applications");
  return outcome;
}

/** Asks HR to move the signed-in Applicant's Interview. Does nothing while the flag is off; a past day or time is rejected here too. */
export async function requestRescheduleAction(formData: FormData): Promise<RescheduleOutcome> {
  const applicant = await careersSession();
  if (!applicant) return { ok: false, message: "Please sign in to request a new interview time." };
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!referenceNumber.success) return { ok: false, message: "Choose a valid Application." };
  const date = rescheduleDateField.safeParse(formData.get("date"));
  if (!date.success) return { ok: false, message: date.error.issues[0]?.message ?? "Choose a day." };
  const time = rescheduleTimeField.safeParse(formData.get("time"));
  if (!time.success) return { ok: false, message: time.error.issues[0]?.message ?? "Choose a time." };
  const note = rescheduleNoteField.safeParse(formData.get("note"));
  if (!note.success) return { ok: false, message: note.error.issues[0]?.message ?? "Check your note and try again." };
  const outcome = await requestReschedule(
    { applicantId: applicant.userId, referenceNumber: referenceNumber.data, date: date.data, time: time.data, note: note.data },
    { enabled: offerRepliesEnabled(), gateway: stubInterviewRescheduleGateway },
  );
  if (outcome.ok) revalidatePath("/careers/applications");
  return outcome;
}
