import { z } from "zod";
import { textField } from "./fields";

/** file-storage accepts up to 25 MB (microservices/file-storage `MAX_SIZE`), so 10 MB is within its cap. */
export const DOCUMENT_MAX_SIZE_MB = 10;
export const DOCUMENT_FORMATS = "PDF, JPG or PNG";
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const documentTypeMessage = `Upload a ${DOCUMENT_FORMATS} file. Word documents and other formats are not accepted.`;
export const documentSizeMessage = `Documents must be ${DOCUMENT_MAX_SIZE_MB} MB or smaller.`;
const documentMaxSizeBytes = DOCUMENT_MAX_SIZE_MB * 1024 * 1024;

const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

/** Some browsers report an empty type for a valid PDF/JPG/PNG; the extension then decides. */
export function documentContentType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  return Object.entries(extensions).find(([, list]) => list.includes(extension))?.[0] ?? "";
}

/** The same rules in the browser and on the server: returns the message to show, or null when the file is acceptable. */
export function documentFileProblem(file: { name: string; type: string; size: number }): string | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!extensions[documentContentType(file)]?.includes(extension)) return documentTypeMessage;
  if (file.size <= 0) return "Choose a file to upload.";
  if (file.size > documentMaxSizeBytes) return documentSizeMessage;
  return null;
}

export const documentUploadSchema = z.object({
  name: textField("File name", {
    min: 1, max: 200, pattern: /^[\p{L}\p{N} ._()'-]+$/u,
    patternMessage: "Use letters, numbers, spaces, dots, underscores, parentheses, apostrophes or hyphens in the file name.",
    rejectInvisible: true,
  }),
  contentType: textField("File type", {
    min: 1, max: 100, pattern: /^(application\/pdf|image\/(jpeg|png))$/,
    patternMessage: documentTypeMessage, rejectInvisible: true,
  }),
  size: z.number().int().positive("Choose a file to upload.").max(documentMaxSizeBytes, documentSizeMessage),
}).refine((file) => extensions[file.contentType]?.includes(file.name.split(".").at(-1)?.toLowerCase() ?? ""), {
  message: `The file extension must match its type (.pdf, .jpg, .jpeg or .png). ${DOCUMENT_FORMATS} only.`, path: ["name"],
});
