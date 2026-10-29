"use client";

import { prepareApplicantDocumentUpload, confirmApplicantDocumentUpload, type ApplicantProfileActionState } from "./actions";

/** Send bytes directly from the browser; only metadata crosses Server Actions. */
export async function submitApplicantDocument(_previous: ApplicantProfileActionState, formData: FormData): Promise<ApplicantProfileActionState> {
  const file = formData.get("document");
  if (!(file instanceof File)) return { message: "Choose a Document to upload." };
  const pending = await prepareApplicantDocumentUpload({ name: file.name, contentType: file.type, size: file.size });
  if ("message" in pending) return pending;
  try {
    const response = await fetch(pending.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) return { message: "We couldn't upload that Document. Try again." };
    return await confirmApplicantDocumentUpload(pending.documentId);
  } catch {
    return { message: "We couldn't upload that Document. Try again." };
  }
}

