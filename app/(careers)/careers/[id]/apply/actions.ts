"use server";

import { revalidatePath } from "next/cache";

import { createApplicationStore, submitApplication } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { sendApplicationReceivedEmail } from "@/lib/email/application-received-email";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicantProfileStore } from "@/lib/careers/profile";
import { applicationConsentField, applicationDocumentIds, jobPostingIdField } from "@/lib/validators/application";

export type ApplicationActionState = { message?: string; referenceNumber?: string };

function makeReferenceNumber() {
  return `BR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function submitApplicationAction(_previous: ApplicationActionState, formData: FormData): Promise<ApplicationActionState> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in before applying." };
  const jobPosting = jobPostingIdField.safeParse(formData.get("jobPostingId"));
  const documentIds = applicationDocumentIds(formData.getAll("documentId"));
  const consent = applicationConsentField.safeParse(formData.get("privacyConsent"));
  if (!jobPosting.success || !documentIds) return { message: "Choose a valid Job Posting and Documents." };
  if (!consent.success) return { message: consent.error.issues[0]?.message ?? "Consent to the data-privacy notice before submitting." };

  try {
    const database = getCareersDatabase();
    const result = await submitApplication(
      { jobPostingId: jobPosting.data, documentIds, consent: consent.data === "yes" },
      {
        identity,
        profile: createApplicantProfileStore(database),
        documents: createApplicantDocumentStore(database),
        postings: createJobPostingStore(database),
        applications: createApplicationStore(database),
        makeReferenceNumber,
        sendConfirmationEmail: sendApplicationReceivedEmail,
      },
    );
    revalidatePath("/careers/applications");
    return {
      referenceNumber: result.referenceNumber,
      message: result.confirmationEmailSent ? undefined : "Your Application was received, but we could not send the confirmation email. Keep your Reference number for your records.",
    };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "We couldn't submit your Application. Try again." };
  }
}
