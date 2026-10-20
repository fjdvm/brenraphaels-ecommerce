import type { TicketFiles } from "@/lib/support/ticket-files";

/** An in-memory file-storage: Private Files, short-lived addresses, and whatever failures a test asks for. */
export class FakeTicketFiles implements TicketFiles {
  files = new Map<string, { filename: string; contentType: string; messageId?: number }>();
  failUpload = false;
  failLink = false;
  private next = 1;

  reset() {
    this.files.clear();
    this.failUpload = false;
    this.failLink = false;
    this.next = 1;
  }

  async upload(file: { filename: string; contentType: string; bytes: Uint8Array }) {
    if (this.failUpload) throw new Error("file-storage is down");
    const id = `file-${this.next++}`;
    this.files.set(id, { filename: file.filename, contentType: file.contentType });
    return id;
  }

  async linkToMessage(fileId: string, messageId: number) {
    if (this.failLink) throw new Error("file-storage is down");
    this.files.get(fileId)!.messageId = messageId;
  }

  async viewUrl(fileId: string) {
    if (!this.files.has(fileId)) throw new Error("File not found");
    return `https://files.test/${fileId}?signature=short-lived`;
  }

  async remove(fileId: string) {
    this.files.delete(fileId);
  }
}
