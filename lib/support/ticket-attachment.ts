import { cleanFileName } from "../validators/sanitize";

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

/** Uploads the image privately, namespaced by Ticket so it can never be guessed. */
export async function uploadTicketAttachment(
  file: File,
  dependencies: {
    ticketId: number;
    put(
      pathname: string,
      body: File,
      options: { access: "private"; addRandomSuffix: true },
    ): Promise<{ pathname: string }>;
  },
): Promise<string> {
  validateTicketAttachment(file);
  const safeName = cleanFileName(file.name);
  const blob = await dependencies.put(`ticket-attachments/${dependencies.ticketId}/${safeName}`, file, {
    access: "private",
    addRandomSuffix: true,
  });
  return blob.pathname;
}
