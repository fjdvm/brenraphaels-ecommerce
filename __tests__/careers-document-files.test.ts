import { expect, test, vi } from "vitest";
import { gatewayDocumentFiles } from "@/lib/careers/document-files";

test("uses the gateway Caller for a Private Permanent File, confirm, and the Document Link", async () => {
  const send = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: "file-1", uploadUrl: "https://signed.test/upload" }))
    .mockResolvedValue(new Response(null, { status: 204 }));
  const files = gatewayDocumentFiles({ baseUrl: "https://gateway.test/", callerKey: "caller", fetch: send });
  expect(await files.prepare({ name: "resume.pdf", contentType: "application/pdf", size: 10 })).toEqual({ fileId: "file-1", uploadUrl: "https://signed.test/upload" });
  await files.confirm("file-1");
  await files.link("file-1", 42);
  expect(send.mock.calls.map(([url]) => url)).toEqual(["https://gateway.test/files", "https://gateway.test/files/file-1/confirm", "https://gateway.test/files/file-1/links"]);
  expect(JSON.parse(send.mock.calls[0][1]!.body as string)).toEqual({ filename: "resume.pdf", contentType: "application/pdf", size: 10, visibility: "private", retentionType: "permanent" });
  expect(JSON.parse(send.mock.calls[2][1]!.body as string)).toEqual({ system: "ECOM", entityType: "applicant-document", entityId: "42", role: "document" });
  expect(send.mock.calls[0][1]!.headers).toEqual({ Authorization: "Bearer caller", "Content-Type": "application/json" });
});

test("gateway failures do not claim success", async () => {
  const files = gatewayDocumentFiles({ baseUrl: "https://gateway.test", callerKey: "caller", fetch: vi.fn().mockResolvedValue(new Response(null, { status: 503 })) });
  await expect(files.confirm("file-1")).rejects.toThrow("couldn't upload");
});
