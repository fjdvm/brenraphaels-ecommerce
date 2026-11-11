"use client";

import { fetchTransport, UploadCancelled, uploadFailedMessage, type UploadProgress, type UploadTransport } from "@/lib/careers/upload-transport";
import { documentContentType, documentFileProblem } from "@/lib/validators/document";
import { prepareApplicantDocumentUpload, confirmApplicantDocumentUpload, type ApplicantProfileActionState } from "./actions";

export type DocumentUploadOptions = { transport?: UploadTransport; onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal };
export type DocumentUploadResult = ApplicantProfileActionState & { cancelled?: boolean };

/** Send bytes directly from the browser; only metadata crosses Server Actions. The rules are checked here and again on the server. */
export async function submitApplicantDocument(_previous: ApplicantProfileActionState, formData: FormData, { transport = fetchTransport, onProgress, signal }: DocumentUploadOptions = {}): Promise<DocumentUploadResult> {
  const chosen = formData.get("document");
  if (!(chosen instanceof File)) return { message: "Choose a Document to upload." };
  const contentType = documentContentType(chosen);
  const file = chosen.type === contentType ? chosen : new File([chosen], chosen.name, { type: contentType });
  const problem = documentFileProblem(file);
  if (problem) return { message: problem };
  const pending = await prepareApplicantDocumentUpload({ name: file.name, contentType, size: file.size });
  if ("message" in pending) return pending;
  try {
    await transport(pending.uploadUrl, file, { onProgress, signal });
  } catch (error) {
    if (error instanceof UploadCancelled || (error instanceof DOMException && error.name === "AbortError")) return { message: "Upload cancelled.", cancelled: true };
    return { message: uploadFailedMessage };
  }
  return confirmApplicantDocumentUpload(pending.documentId).catch(() => ({ message: uploadFailedMessage }));
}
