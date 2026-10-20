import { describe, expect, test, vi } from "vitest";

import { gatewayTicketFiles } from "../lib/support/ticket-files";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("the file-storage client", () => {
  test("uploads privately and permanently: request an address, PUT the bytes, confirm", async () => {
    const send = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target === "https://gw.test/files" && init?.method === "POST")
        return json({ id: "f1", uploadUrl: "https://bucket.test/signed" }, 201);
      if (target === "https://bucket.test/signed") return new Response(null, { status: 200 });
      return json({ id: "f1" });
    });
    const files = gatewayTicketFiles({ baseUrl: "https://gw.test/", callerKey: "key", fetch: send as typeof fetch });

    await expect(files.upload({ filename: "a.png", contentType: "image/png", bytes: new Uint8Array(3) })).resolves.toBe("f1");

    const [request, put, confirm] = send.mock.calls;
    expect(JSON.parse(request[1]!.body as string)).toEqual({
      filename: "a.png", contentType: "image/png", size: 3, visibility: "private", retentionType: "permanent",
    });
    expect((request[1]!.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(put[1]!.method).toBe("PUT");
    expect((put[1]!.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(String(confirm[0])).toBe("https://gw.test/files/f1/confirm");
  });

  test("Links a File to a Message as the ECOM Client System, and reads its short-lived address", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the second parameter types the recorded calls
    const send = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).endsWith("/links") ? new Response(null, { status: 204 }) : json({ url: "https://signed.test/x" }),
    );
    const files = gatewayTicketFiles({ baseUrl: "https://gw.test", callerKey: "key", fetch: send as typeof fetch });

    await files.linkToMessage("f1", 9);
    await expect(files.viewUrl("f1")).resolves.toBe("https://signed.test/x");

    expect(JSON.parse(send.mock.calls[0][1]!.body as string)).toEqual({
      system: "ECOM", entityType: "ticket-message", entityId: "9", role: "attachment",
    });
  });

  test("fails loudly when the gateway refuses or is not configured", async () => {
    const refused = gatewayTicketFiles({ baseUrl: "https://gw.test", callerKey: "key", fetch: (async () => json({}, 404)) as typeof fetch });
    await expect(refused.viewUrl("gone")).rejects.toThrow("404");
    await expect(gatewayTicketFiles({ baseUrl: "", callerKey: "" }).viewUrl("x")).rejects.toThrow("API_GATEWAY_URL");
  });
});
