import type { DocumentFiles } from "@/lib/careers/document-files";

export class FakeDocumentFiles implements DocumentFiles {
  files = new Map<string, { name: string; contentType: string; size: number; visibility: "private"; retentionType: "permanent"; confirmed: boolean; documentId?: number }>();
  failConfirm = false;
  failLink = false;
  async prepare(file: { name: string; contentType: string; size: number }) {
    const fileId = `file-${this.files.size + 1}`;
    this.files.set(fileId, { ...file, visibility: "private", retentionType: "permanent", confirmed: false });
    return { fileId, uploadUrl: `https://files.test/${fileId}/upload?signed` };
  }
  async confirm(fileId: string) {
    if (this.failConfirm) throw new Error("Confirmation failed");
    this.files.get(fileId)!.confirmed = true;
  }
  async link(fileId: string, documentId: number) {
    if (this.failLink) throw new Error("Link failed");
    this.files.get(fileId)!.documentId = documentId;
  }
}
