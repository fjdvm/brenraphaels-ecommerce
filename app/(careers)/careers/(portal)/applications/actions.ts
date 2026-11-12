"use server";

import { revalidatePath } from "next/cache";

import { createApplicationStore, withdrawApplication } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { requestReschedule, stubInterviewRescheduleGateway, type RescheduleOutcome } from "@/lib/careers/interview-reschedule";
import { createHrmsOfferReplyGateway, offerRepliesComingSoon, offerRepliesEnabled, replyToOffer, type OfferReplyOutcome } from "@/lib/careers/offer-reply";
import { applicationReferenceNumberField, rescheduleDateField, rescheduleNoteField, rescheduleTimeField } from "@/lib/validators/application";
import { gatewayDocumentFiles } from "@/lib/careers/document-files";
import { hrmsOfferDocumentGateway, offerDocumentFailedMessage, offerDocumentUploadedMessage, prepareOfferDocument, readRequestedDocuments, submitOfferDocument } from "@/lib/careers/offer-documents";

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

/** The signed-in Applicant's Offer for this Application, read from the shared database, then answered through HRMS. */
async function reply(formData: FormData, kind: "accept" | "decline"): Promise<OfferReplyOutcome> {
  const applicant = await careersSession();
  if (!applicant) return { ok: false, message: "Please sign in to reply to your offer." };
  if (!offerRepliesEnabled()) return { ok: false, message: offerRepliesComingSoon };
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!referenceNumber.success) return { ok: false, message: "Choose a valid Application to reply to." };
  let offer;
  try {
    offer = await createApplicationStore(getCareersDatabase()).findOfferForApplicant(applicant.userId, referenceNumber.data);
  } catch (error) {
    console.error("Offer could not be read", error instanceof Error ? error.message : error);
    return { ok: false, message: "We couldn't load your offer. Try again." };
  }
  if (!offer) return { ok: false, message: "We couldn't find an offer for this application." };
  // A reply is final, and an Offer that was never sent has nothing to answer. HRMS enforces the same rules.
  if (offer.status !== "Sent") return { ok: false, message: "This offer has already been answered. A reply is final." };
  return replyToOffer({ kind, applicantId: applicant.userId, offerId: offer.id }, { enabled: true, gateway: createHrmsOfferReplyGateway() });
}

/** Accepts the signed-in Applicant's Offer through HRMS. Does nothing while the offer-replies flag is off. */
export async function acceptOfferAction(formData: FormData): Promise<OfferReplyOutcome> {
  const outcome = await reply(formData, "accept");
  if (outcome.ok) revalidateOfferPages(formData);
  return outcome;
}

/** Declines the signed-in Applicant's Offer through HRMS. Does nothing while the flag is off. */
export async function declineOfferAction(formData: FormData): Promise<OfferReplyOutcome> {
  const outcome = await reply(formData, "decline");
  if (outcome.ok) revalidateOfferPages(formData);
  return outcome;
}

/** The list and the Application page both show the Offer's state. */
function revalidateOfferPages(formData: FormData) {
  revalidatePath("/careers/applications");
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (referenceNumber.success) revalidatePath(`/careers/applications/${referenceNumber.data}`);
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

const requestedFor = (applicantId: string, referenceNumber: string) => readRequestedDocuments(getCareersDatabase(), applicantId, referenceNumber);

/** Checks the file and the request, then returns a signed address for the browser to send the bytes to. Nothing is recorded yet. */
export async function prepareOfferDocumentUpload(input: { referenceNumber: unknown; type: unknown; name: unknown; contentType: unknown; size: unknown }): Promise<{ fileId: string; uploadUrl: string } | { message: string }> {
  const applicant = await careersSession();
  if (!applicant) return { message: "Please sign in to upload a Document." };
  const referenceNumber = applicationReferenceNumberField.safeParse(input?.referenceNumber);
  if (!referenceNumber.success) return { message: "Choose a valid Application." };
  if (!process.env.API_GATEWAY_URL || !process.env.API_GATEWAY_CALLER_KEY) return { message: "Document uploads are not configured yet." };
  try {
    return await prepareOfferDocument(
      { applicantId: applicant.userId, referenceNumber: referenceNumber.data, type: input.type, file: { name: input.name, contentType: input.contentType, size: input.size } },
      { files: gatewayDocumentFiles(), requested: requestedFor },
    );
  } catch (error) {
    return { message: error instanceof Error ? error.message : offerDocumentFailedMessage };
  }
}

/** After the bytes are stored: tells HRMS the type and file id. On failure the Document stays Requested and the Applicant can retry. */
export async function submitOfferDocumentUpload(input: { referenceNumber: unknown; type: unknown; fileId: unknown; fileName: unknown }): Promise<{ message: string }> {
  const applicant = await careersSession();
  if (!applicant) return { message: "Please sign in to upload a Document." };
  const referenceNumber = applicationReferenceNumberField.safeParse(input?.referenceNumber);
  if (!referenceNumber.success) return { message: "Choose a valid Application." };
  try {
    await submitOfferDocument(
      { applicantId: applicant.userId, referenceNumber: referenceNumber.data, type: input.type, fileId: input.fileId, fileName: input.fileName },
      { files: gatewayDocumentFiles(), gateway: hrmsOfferDocumentGateway(), requested: requestedFor },
    );
  } catch (error) {
    console.error("Offer document could not be submitted", error);
    return { message: offerDocumentFailedMessage };
  }
  revalidatePath("/careers/applications");
  return { message: offerDocumentUploadedMessage };
}
