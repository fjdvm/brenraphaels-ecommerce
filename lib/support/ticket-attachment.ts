import type { TicketFiles } from "./ticket-files";

const acceptedAttachmentTypes = new Set(["image/jpeg", "image/png"]);
const maximumAttachmentBytes = 5 * 1024 * 1024;

export function validateTicketAttachment(file: File) {
  if (!acceptedAttachmentTypes.has(file.type)) {
    throw new Error("Attach a JPEG or PNG image.");
  }
  if (file.size === 0) {
    throw new Error("Choose an image to attach.");
  }
  if (file.size > maximumAttachmentBytes) {
    throw new Error("Images must be 5 MB or smaller.");
  }
}

/** Stores the image as a Private File in file-storage and returns its id. */
export async function uploadTicketAttachment(file: File, files: Pick<TicketFiles, "upload">): Promise<string> {
  validateTicketAttachment(file);

  return files.upload({
    filename: file.name,
    contentType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
}
