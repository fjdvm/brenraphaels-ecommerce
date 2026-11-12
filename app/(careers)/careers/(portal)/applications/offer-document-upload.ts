"use client";

import { fetchTransport, UploadCancelled, uploadFailedMessage } from "@/lib/careers/upload-transport";
import { documentContentType, documentFileProblem } from "@/lib/validators/document";
import { offerDocumentUploadedMessage } from "@/lib/careers/offer-documents";
import type { DocumentUploadOptions, DocumentUploadResult } from "../profile/document-upload";
import { prepareOfferDocumentUpload, submitOfferDocumentUpload } from "./actions";

/**
 * Upload one requested Document: the type and size are checked here and again on the server, the bytes go straight to file-storage,
 * then HRMS is told. A failed HRMS call returns a message and leaves the row Requested so the same button retries.
 */
export async function uploadOfferDocument(target: { referenceNumber: string; type: string }, formData: FormData, { transport = fetchTransport, onProgress, signal }: DocumentUploadOptions = {}): Promise<DocumentUploadResult> {
  const chosen = formData.get("document");
  if (!(chosen instanceof File)) return { message: "Choose a Document to upload." };
  const contentType = documentContentType(chosen);
  const file = chosen.type === contentType ? chosen : new File([chosen], chosen.name, { type: contentType });
  const problem = documentFileProblem(file);
  if (problem) return { message: problem };
  const pending = await prepareOfferDocumentUpload({ ...target, name: file.name, contentType, size: file.size }).catch(() => ({ message: uploadFailedMessage }));
  if ("message" in pending) return pending;
  try {
    await transport(pending.uploadUrl, file, { onProgress, signal });
  } catch (error) {
    if (error instanceof UploadCancelled || (error instanceof DOMException && error.name === "AbortError")) return { message: "Upload cancelled.", cancelled: true };
    return { message: uploadFailedMessage };
  }
  const result = await submitOfferDocumentUpload({ ...target, fileId: pending.fileId, fileName: file.name }).catch(() => ({ message: uploadFailedMessage }));
  return result.message === offerDocumentUploadedMessage ? result : { message: result.message };
}
