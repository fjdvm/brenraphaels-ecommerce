import { z } from "zod";
import { textField } from "./fields";

const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

export const documentUploadSchema = z.object({
  name: textField("File name", {
    min: 1, max: 200, pattern: /^[\p{L}\p{N} ._()'-]+$/u,
    patternMessage: "Use letters, numbers, spaces, dots, underscores, parentheses, apostrophes or hyphens in the file name.",
    rejectInvisible: true,
  }),
  contentType: textField("File type", {
    min: 1, max: 100, pattern: /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(jpeg|png))$/,
    patternMessage: "Upload a PDF, Word document, or image (JPEG or PNG).", rejectInvisible: true,
  }),
  size: z.number().int().positive("Choose a file to upload.").max(10 * 1024 * 1024, "Documents must be 10 MB or smaller."),
}).refine((file) => extensions[file.contentType]?.includes(file.name.split(".").at(-1)?.toLowerCase() ?? ""), {
  message: "The file extension must match its type (.pdf, .doc, .docx, .jpg, .jpeg or .png).", path: ["name"],
});
