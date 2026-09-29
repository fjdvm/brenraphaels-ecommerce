import { describe, expect, test, vi } from "vitest";

import { uploadTicketAttachment, validateTicketAttachment } from "../lib/support/ticket-attachment";

function image(type: string, size: number, name = "photo.png") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("Ticket attachment validation", () => {
  test("accepts a JPEG or PNG within 5 MB", () => {
    expect(() => validateTicketAttachment(image("image/jpeg", 10, "a.jpg"))).not.toThrow();
    expect(() => validateTicketAttachment(image("image/png", 5 * 1024 * 1024))).not.toThrow();
  });

  test("rejects other file types, empty files, and files over 5 MB", () => {
    expect(() => validateTicketAttachment(image("image/gif", 10))).toThrow("JPEG or PNG");
    expect(() => validateTicketAttachment(image("application/pdf", 10))).toThrow("JPEG or PNG");
    expect(() => validateTicketAttachment(image("image/png", 0))).toThrow("Choose an image");
    expect(() => validateTicketAttachment(image("image/png", 5 * 1024 * 1024 + 1))).toThrow("5 MB");
  });

  test("uploads privately under the Ticket with a sanitized name and returns only the pathname", async () => {
    const put = vi.fn().mockResolvedValue({ pathname: "ticket-attachments/7/my-photo-abc.png", url: "https://blob/x" });

    await expect(uploadTicketAttachment(image("image/png", 10, "my/photo.png"), { ticketId: 7, put })).resolves.toBe(
      "ticket-attachments/7/my-photo-abc.png",
    );
    expect(put).toHaveBeenCalledWith("ticket-attachments/7/my-photo.png", expect.any(File), {
      access: "private",
      addRandomSuffix: true,
    });
  });

  test("does not upload an invalid file", async () => {
    const put = vi.fn();
    await expect(uploadTicketAttachment(image("image/gif", 10), { ticketId: 7, put })).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});
