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

  test("stores the image through file-storage with its real name and type, returning the file id", async () => {
    const upload = vi.fn().mockResolvedValue("file-7");

    await expect(uploadTicketAttachment(image("image/png", 10, "my-photo.png"), { upload })).resolves.toBe("file-7");
    expect(upload).toHaveBeenCalledWith({
      filename: "my-photo.png",
      contentType: "image/png",
      bytes: expect.any(Uint8Array),
    });
    expect(upload.mock.calls[0][0].bytes).toHaveLength(10);
  });

  test("does not store an invalid file", async () => {
    const upload = vi.fn();
    await expect(uploadTicketAttachment(image("image/gif", 10), { upload })).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });
});
