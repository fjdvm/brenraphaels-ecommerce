/** The file-storage boundary, reached through the api-gateway. Tests replace it with a fake. */
export type TicketFiles = {
  /** Stores the bytes as an Active, Private, Permanent File and returns its id. */
  upload(file: { filename: string; contentType: string; bytes: Uint8Array }): Promise<string>;
  /** Labels the File as belonging to a Message. */
  linkToMessage(fileId: string, messageId: number): Promise<void>;
  /** A short-lived signed address to show the File from. */
  viewUrl(fileId: string): Promise<string>;
  remove(fileId: string): Promise<void>;
};

type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

/** Calls file-storage through the gateway as the storefront's Caller, which the gateway maps to the ECOM Client System. */
export function gatewayTicketFiles({
  baseUrl = process.env.API_GATEWAY_URL,
  callerKey = process.env.API_GATEWAY_CALLER_KEY,
  fetch: send = fetch,
}: Gateway = {}): TicketFiles {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_CALLER_KEY must be set.");

    const response = await send(`${baseUrl.replace(/\/$/, "")}/files${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`file-storage refused ${init.method ?? "GET"} ${path}: ${response.status}`);

    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    async upload({ filename, contentType, bytes }) {
      const pending = await call<{ id: string; uploadUrl: string }>("", {
        method: "POST",
        body: JSON.stringify({ filename, contentType, size: bytes.length, visibility: "private", retentionType: "permanent" }),
      });
      // The signed address is file-storage's own, so it takes no gateway key.
      const put = await send(pending.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes as BodyInit });
      if (!put.ok) throw new Error(`The image upload was refused: ${put.status}`);
      await call(`/${pending.id}/confirm`, { method: "POST" });

      return pending.id;
    },
    async linkToMessage(fileId, messageId) {
      await call(`/${fileId}/links`, {
        method: "POST",
        body: JSON.stringify({ system: "ECOM", entityType: "ticket-message", entityId: String(messageId), role: "attachment" }),
      });
    },
    async viewUrl(fileId) {
      return (await call<{ url: string }>(`/${fileId}`)).url;
    },
    async remove(fileId) {
      await call(`/${fileId}`, { method: "DELETE" });
    },
  };
}
