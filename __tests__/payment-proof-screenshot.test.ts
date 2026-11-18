import { beforeEach, describe, expect, test, vi } from "vitest";

import { uploadPaymentProofScreenshot } from "../lib/orders/payment-proof";
import { FakeTicketFiles } from "./fake-ticket-files";

const { blobGet, currentVisitor, getScreenshot, viewUrl } = vi.hoisted(() => ({
  blobGet: vi.fn(),
  currentVisitor: vi.fn(),
  getScreenshot: vi.fn(),
  viewUrl: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get: blobGet }));
vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/orders/orders", () => ({ createOrderStore: () => ({ getPaymentProofScreenshot: getScreenshot }) }));
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => ({ viewUrl }) }));

import { GET } from "@/app/api/orders/[id]/payment-proof/route";

const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const file = (type = "image/png", size = 12, name = "receipt.png") => {
  const bytes = new Uint8Array(size);
  header.forEach((byte, index) => { if (index < size) bytes[index] = byte; });
  return new File([bytes], name, { type });
};

describe("uploading a payment-proof screenshot", () => {
  const files = new FakeTicketFiles();
  beforeEach(() => files.reset());

  test("stores a Private File in file-storage and returns its id", async () => {
    const id = await uploadPaymentProofScreenshot(file(), files);

    expect(files.files.get(id)).toMatchObject({ filename: "receipt.png", contentType: "image/png" });
  });

  test("refuses the wrong type and oversize files with the existing messages, storing nothing", async () => {
    await expect(uploadPaymentProofScreenshot(file("application/pdf"), files)).rejects.toThrow("Upload a JPEG or PNG screenshot.");
    await expect(uploadPaymentProofScreenshot(file("image/png", 5 * 1024 * 1024 + 1), files)).rejects.toThrow("Screenshots must be 5 MB or smaller.");
    expect(files.files.size).toBe(0);
  });

  test("refuses a file whose bytes are not the image its type claims, storing nothing", async () => {
    await expect(uploadPaymentProofScreenshot(new File(["<script>alert(1)</script>"], "receipt.png", { type: "image/png" }), files)).rejects.toThrow("real JPEG or PNG");
    await expect(uploadPaymentProofScreenshot(file("image/jpeg"), files)).rejects.toThrow("real JPEG or PNG");
    expect(files.files.size).toBe(0);
  });

  test("accepts real JPEG bytes", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], "r.jpg", { type: "image/jpeg" });
    await expect(uploadPaymentProofScreenshot(jpeg, files)).resolves.toEqual(expect.any(String));
  });
});

describe("payment-proof route", () => {
  const request = new Request("http://localhost/api/orders/4/payment-proof");
  const context = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

  beforeEach(() => {
    process.env.ORDERS_BLOB_READ_WRITE_TOKEN = "test-token";
    currentVisitor.mockReset().mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
    getScreenshot.mockReset().mockResolvedValue({ fileId: "f1" });
    viewUrl.mockReset().mockResolvedValue("https://files.test/f1?signature=short-lived");
    blobGet.mockReset().mockResolvedValue({ statusCode: 200, stream: new Response("png-bytes").body, blob: { contentType: "image/png" } });
  });

  test("sends the owner to a short-lived address for a File in file-storage", async () => {
    const response = await GET(request, context("4"));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://files.test/f1?signature=short-lived");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getScreenshot).toHaveBeenCalledWith("customer-1", 4);
    expect(blobGet).not.toHaveBeenCalled();
  });

  test("streams a legacy Blob pathname", async () => {
    getScreenshot.mockResolvedValue({ pathname: "payment-proofs/4/r.png" });

    const response = await GET(request, context("4"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("png-bytes");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(blobGet).toHaveBeenCalledWith("payment-proofs/4/r.png", { access: "private", token: "test-token" });
    expect(viewUrl).not.toHaveBeenCalled();
  });

  test("answers 404 for visitors, non-owners, bad ids, missing screenshots and storage failures", async () => {
    currentVisitor.mockResolvedValueOnce({ state: "signed-out" });
    expect((await GET(request, context("4"))).status).toBe(404);
    getScreenshot.mockResolvedValueOnce(undefined);
    expect((await GET(request, context("4"))).status).toBe(404);
    expect((await GET(request, context("abc"))).status).toBe(404);
    viewUrl.mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(request, context("4"))).status).toBe(404);
  });
});
