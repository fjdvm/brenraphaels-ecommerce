import { expect, test, vi } from "vitest";
import { gatewayReturnEvidence, validateReturnEvidence } from "../lib/returns/evidence-files";

const owner = { customerId: "customer-1", orderId: 12 };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZWQAAAAASUVORK5CYII=", "base64");
const metadata = { id: "file-1", status: "active", contentType: "image/png", size: png.length, visibility: "private", retentionType: "temporary", url: "https://storage.test/private-file" };
function fixture(overrides = {}, bytes: Uint8Array = png, sealedOverrides = {}) {
  let clock = 1000;
  let sealedBytes: Uint8Array | undefined;
  const send = vi.fn<typeof fetch>(async (url, init) => {
    if (url === "https://gateway.test/files") {
      const permanent = JSON.parse(String(init?.body)).retentionType === "permanent";
      return Response.json({ id: permanent ? "sealed-file" : "file-1", uploadUrl: permanent ? "https://storage.test/server-only-put" : "https://storage.test/signed-put" });
    }
    if (url === "https://gateway.test/files/file-1/confirm") return Response.json(metadata);
    if (url === "https://gateway.test/files/file-1") return Response.json({ ...metadata, ...overrides });
    if (url === "https://storage.test/private-file") return new Response(new Uint8Array(bytes));
    if (url === "https://storage.test/server-only-put") { sealedBytes = new Uint8Array(init?.body as Uint8Array); return new Response(null, { status: 204 }); }
    if (url === "https://gateway.test/files/sealed-file/confirm") return Response.json({ ...metadata, id: "sealed-file", retentionType: "permanent", ...sealedOverrides });
    if (url === "https://storage.test/signed-put") { bytes = new Uint8Array(init?.body as Uint8Array); return new Response(null, { status: 204 }); }
    throw new Error("Unexpected URL");
  });
  const files = gatewayReturnEvidence({ baseUrl: "https://gateway.test", callerKey: "secret-caller-credential", fetch: send, now: () => clock });
  return { files, send, sealed: () => sealedBytes, advance: () => { clock += 3600000; } };
}
const photoRequest = { role: "photo" as const, contentType: "image/png" as const, size: png.length };

test("seals verified staging bytes as a distinct Private, Permanent File without exposing its upload URL", async () => {
  const { files, send, sealed } = fixture();
  const upload = await files.prepare(owner, photoRequest);
  expect(upload).toMatchObject({ id: "file-1", uploadUrl: "https://storage.test/signed-put", uploadToken: expect.any(String) });
  expect(JSON.stringify(upload)).not.toContain("secret-caller-credential");
  expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({ filename: "return-photo.png", contentType: "image/png",
    size: png.length, visibility: "private", retentionType: "temporary" });
  const result = await files.read(owner, "photo", upload.uploadToken);
  expect(result).toEqual({ id: "sealed-file", bytes: png });
  expect(JSON.stringify(result)).not.toContain("server-only-put");
  expect(JSON.parse(String(send.mock.calls[4][1]?.body))).toMatchObject({ visibility: "private", retentionType: "permanent", size: png.length, contentType: "image/png" });
  await send(upload.uploadUrl, { method: "PUT", body: new TextEncoder().encode("overwritten staging bytes") });
  expect(sealed()).toEqual(new Uint8Array(png));
  expect(send.mock.calls[1][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer secret-caller-credential" } });
  expect(send.mock.calls[3][1]).not.toHaveProperty("headers");
});

test("refuses another Customer, another Order, a different purpose, altered signatures and expired uploads before storage access", async () => {
  const { files, send, advance } = fixture();
  const upload = await files.prepare(owner, photoRequest);
  await expect(files.read({ ...owner, customerId: "customer-2" }, "photo", upload.uploadToken)).rejects.toThrow("this Customer and Order");
  await expect(files.read({ ...owner, orderId: 13 }, "photo", upload.uploadToken)).rejects.toThrow("this Customer and Order");
  await expect(files.read(owner, "video", upload.uploadToken)).rejects.toThrow("this Customer and Order");
  await expect(files.read(owner, "photo", `${upload.uploadToken}x`)).rejects.toThrow("this Customer and Order");
  await expect(files.read(owner, "photo", "file-1")).rejects.toThrow("this Customer and Order");
  advance();
  await expect(files.read(owner, "photo", upload.uploadToken)).rejects.toThrow("this Customer and Order");
  expect(send).toHaveBeenCalledTimes(1);
});

test.each([{ status: "pending" }, { visibility: "public" }, { retentionType: "permanent" }, { id: "other-file" },
  { contentType: "text/plain" }, { size: 0 }, { size: 5 * 1024 * 1024 + 1 }, { size: 1.5 }])("refuses invalid confirmed metadata: %j", async (overrides) => {
  const { files, send } = fixture(overrides);
  const upload = await files.prepare(owner, photoRequest);
  await expect(files.read(owner, "photo", upload.uploadToken)).rejects.toThrow();
  expect(send).toHaveBeenCalledTimes(3);
});

test.each([{ status: "pending" }, { visibility: "public" }, { retentionType: "temporary" }, { id: "file-1" },
  { contentType: "image/jpeg" }, { size: 1 }])("does not accept a sealed File until its confirmed metadata is correct: %j", async (overrides) => {
  const { files } = fixture({}, png, overrides);
  const upload = await files.prepare(owner, photoRequest);
  await expect(files.read(owner, "photo", upload.uploadToken)).rejects.toThrow();
});

test.each([
  [{}, Buffer.from("not a PNG")],
  [{ contentType: "image/jpeg" }, png],
  [{ size: png.length + 1 }, png],
  [{}, new Uint8Array(5 * 1024 * 1024 + 1)],
] as const)("inspects real bytes and enforces streamed size", async (overrides, bytes) => {
  const { files } = fixture(overrides, bytes);
  const upload = await files.prepare(owner, photoRequest);
  await expect(files.read(owner, "photo", upload.uploadToken)).rejects.toThrow();
});

test.each([
  { ...photoRequest, size: 5 * 1024 * 1024 + 1 }, { ...photoRequest, size: 0 },
  { ...photoRequest, contentType: "video/mp4" }, { role: "video", contentType: "video/mp4", size: 25 * 1024 * 1024 + 1 },
])("refuses wrong upload type/size before requesting a presigned URL: %j", async (input) => {
  const { files, send } = fixture();
  await expect(files.prepare(owner, input as typeof photoRequest)).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});

test.each([
  ["photo", "ffd8ffe000104a46494600010100000100010000", "image/jpeg"],
  ["video", "00000018667479706d703432000000006d70343269736f6d", "video/mp4"],
  ["video", "0000001466747970717420200000000071742020", "video/quicktime"],
] as const)("identifies %s evidence from its bytes (%s)", async (role, hex, mime) => {
  expect(await validateReturnEvidence(Buffer.from(hex, "hex"), role)).toMatchObject({ mime });
});

test("enforces exact photo and video byte limits", async () => {
  const maxPhoto = new Uint8Array(5 * 1024 * 1024);
  maxPhoto.set(png);
  expect(await validateReturnEvidence(maxPhoto, "photo")).toMatchObject({ mime: "image/png" });
  const maxVideo = new Uint8Array(25 * 1024 * 1024);
  maxVideo.set(Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex"));
  expect(await validateReturnEvidence(maxVideo, "video")).toMatchObject({ mime: "video/mp4" });
  await expect(validateReturnEvidence(new Uint8Array(25 * 1024 * 1024 + 1), "video")).rejects.toThrow("25 MB");
  await expect(validateReturnEvidence(png, "video")).rejects.toThrow("MP4 or MOV");
});
