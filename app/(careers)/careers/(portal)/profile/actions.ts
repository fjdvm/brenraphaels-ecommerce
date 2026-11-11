"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { careersSession } from "@/lib/careers/auth";
import { createApplicationStore, syncApplicationProfileSnapshots } from "@/lib/careers/applications";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore, prepareApplicantDocument, confirmApplicantDocument, openApplicantDocument } from "@/lib/careers/documents";
import { documentUploadedMessage } from "@/lib/careers/upload-transport";
import { gatewayDocumentFiles } from "@/lib/careers/document-files";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicantProfileStore, saveApplicantProfile } from "@/lib/careers/profile";
function entries(formData: FormData, key: string) { return formData.getAll(key).map((value) => String(value)); }
export type ApplicantProfileActionState = {
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Set once the profile is stored; the form shows the result card. */
  saved?: boolean;
  /** What was typed, so a rejected form keeps it instead of being reset. */
  values?: { fullName: string; phone: string; location: string; summary: string; skills: string; education: Array<Record<string, string>>; workHistory: Array<Record<string, string>> };
};

/** Rows the Applicant left completely empty are ignored; a partly filled row is validated in full. */
function filledRows<T extends Record<string, string>>(rows: T[]) {
  return rows.flatMap((row, index) => (Object.values(row).some((value) => value.trim() !== "") ? [{ row, index }] : []));
}

/** Keys each problem by the field's input id (`fullName`, `education-0-school`), first message wins. */
function fieldErrorsFrom(error: z.ZodError, originalIndexes: { education: number[]; workHistory: number[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String);
    const section = path[0] === "education" || path[0] === "workHistory" ? path[0] : null;
    const key = section ? [section, originalIndexes[section][Number(path[1])] ?? path[1], ...path.slice(2)].join("-") : path.join("-") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function submitApplicantProfile(_previous: ApplicantProfileActionState, formData: FormData): Promise<ApplicantProfileActionState> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in to save your profile." };
  const schools = entries(formData, "school");
  const employers = entries(formData, "employer");
  const allEducation = schools.map((school, index) => ({
    school,
    qualification: entries(formData, "qualification")[index] ?? "",
    fieldOfStudy: entries(formData, "fieldOfStudy")[index] ?? "",
    startedOn: entries(formData, "educationStartedOn")[index] ?? "",
    completedOn: entries(formData, "completedOn")[index] ?? "",
  }));
  const educationRows = filledRows(allEducation);
  const allWorkHistory = employers.map((employer, index) => ({
    employer,
    title: entries(formData, "title")[index] ?? "",
    startedOn: entries(formData, "workStartedOn")[index] ?? "",
    endedOn: entries(formData, "endedOn")[index] ?? "",
    description: entries(formData, "description")[index] ?? "",
  }));
  const workHistoryRows = filledRows(allWorkHistory);
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    location: String(formData.get("location") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    skills: String(formData.get("skills") ?? ""),
    education: allEducation,
    workHistory: allWorkHistory,
  };
  try {
    const profile = await saveApplicantProfile({
      ...values,
      education: educationRows.map(({ row }) => row),
      workHistory: workHistoryRows.map(({ row }) => row),
    }, { identity, store: createApplicantProfileStore(getCareersDatabase()) });
    try {
      await syncApplicationProfileSnapshots(identity.userId, profile, { applications: createApplicationStore(getCareersDatabase()), postings: createJobPostingStore(getCareersDatabase()) });
    } catch (error) {
      console.error("Could not sync the profile edit into unfrozen Applications", error);
    }
    revalidatePath("/careers/profile");
    revalidatePath("/careers/complete-profile");
    revalidatePath("/careers/applications");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        message: "Check the highlighted fields.",
        values,
        fieldErrors: fieldErrorsFrom(error, { education: educationRows.map(({ index }) => index), workHistory: workHistoryRows.map(({ index }) => index) }),
      };
    }
    console.error("Saving Applicant profile failed", error);
    return { message: "We couldn't save your profile. Try again.", values };
  }
  return { saved: true };
}
/** Validates metadata and returns a signed address for a pending Document. */
export async function prepareApplicantDocumentUpload(input: unknown): Promise<{ documentId: number; uploadUrl: string } | { message: string }> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in to upload a Document." };
  if (!process.env.API_GATEWAY_URL || !process.env.API_GATEWAY_CALLER_KEY) return { message: "Document uploads are not configured yet." };
  try {
    return await prepareApplicantDocument(input, { applicantId: identity.userId, store: createApplicantDocumentStore(getCareersDatabase()), files: gatewayDocumentFiles() });
  } catch (error) {
    return { message: error instanceof Error ? error.message : "We couldn't upload that Document." };
  }
}

/** Ownership comes from the session; usability follows confirmation and linking. */
export async function confirmApplicantDocumentUpload(documentId: unknown): Promise<ApplicantProfileActionState> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in to upload a Document." };
  if (!process.env.API_GATEWAY_URL || !process.env.API_GATEWAY_CALLER_KEY) return { message: "Document uploads are not configured yet." };
  try {
    await confirmApplicantDocument(documentId, { applicantId: identity.userId, store: createApplicantDocumentStore(getCareersDatabase()), files: gatewayDocumentFiles() });
    revalidatePath("/careers", "layout");
    return { message: documentUploadedMessage };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "We couldn't upload that Document." };
  }
}

/** A fresh short-lived link per open; a Document that is not the session Applicant's is never linked. */
export async function openApplicantDocumentLink(documentId: unknown): Promise<{ url: string } | { message: string }> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in to open a Document." };
  if (!process.env.API_GATEWAY_URL || !process.env.API_GATEWAY_CALLER_KEY) return { message: "Documents can't be opened yet." };
  try {
    const url = await openApplicantDocument(documentId, { applicantId: identity.userId, store: createApplicantDocumentStore(getCareersDatabase()), files: gatewayDocumentFiles() });
    return { url };
  } catch (error) {
    // Only messages written for the Applicant reach the browser.
    const known = ["Document not found.", "Choose a valid Document.", "We couldn't open that Document. Try again."];
    return { message: error instanceof Error && known.includes(error.message) ? error.message : "We couldn't open that Document. Try again." };
  }
}

/** Save immediately; ownership always comes from the authenticated session. */
export async function setApplicantJobAlerts(input: unknown): Promise<{ jobAlertsOptIn: boolean } | { message: string }> {
  const identity = await careersSession();
  if (!identity) return { message: "Please sign in to change job-alert emails." };
  const parsed = z.object({ jobAlertsOptIn: z.boolean() }).safeParse(input);
  if (!parsed.success) return { message: "Choose whether to receive job-alert emails." };
  try {
    const saved = await createApplicantProfileStore(getCareersDatabase())
      .setJobAlertsOptIn(identity.userId, parsed.data.jobAlertsOptIn);
    if (!saved) return { message: "Complete your Applicant profile before changing job-alert emails." };
    revalidatePath("/careers/profile");
    return parsed.data;
  } catch (error) {
    console.error("Saving Applicant job-alert preference failed", error);
    return { message: "We couldn't save your job-alert preference. Try again." };
  }
}
