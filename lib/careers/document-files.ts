/** File-storage owns the bytes; Careers owns the Document and when it becomes usable. */
export type DocumentFiles = {
  prepare(file: { name: string; contentType: string; size: number }): Promise<{ fileId: string; uploadUrl: string }>;
  confirm(fileId: string): Promise<void>;
  link(fileId: string, documentId: number): Promise<void>;
};

export function gatewayDocumentFiles({
  baseUrl = process.env.API_GATEWAY_URL,
  callerKey = process.env.API_GATEWAY_CALLER_KEY,
  fetch: send = fetch,
}: { baseUrl?: string; callerKey?: string; fetch?: typeof fetch } = {}): DocumentFiles {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    if (!baseUrl || !callerKey) throw new Error("Document uploads are not configured yet.");
    const response = await send(`${baseUrl.replace(/\/$/, "")}/files${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error("We couldn't upload that Document. Try again.");
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
  return {
    async prepare(file) {
      const pending = await call<{ id: string; uploadUrl: string }>("", {
        filename: file.name, contentType: file.contentType, size: file.size,
        visibility: "private", retentionType: "permanent",
      });
      return { fileId: pending.id, uploadUrl: pending.uploadUrl };
    },
    async confirm(fileId) { await call(`/${encodeURIComponent(fileId)}/confirm`); },
    async link(fileId, documentId) {
      await call(`/${encodeURIComponent(fileId)}/links`, {
        system: "ECOM", entityType: "applicant-document", entityId: String(documentId), role: "document",
      });
    },
  };
}
