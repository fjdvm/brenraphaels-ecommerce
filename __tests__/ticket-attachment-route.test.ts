import { beforeEach, describe, expect, test, vi } from "vitest";

const { blobGet, currentVisitor, getAttachment, viewUrl } = vi.hoisted(() => ({
  blobGet: vi.fn(),
  currentVisitor: vi.fn(),
  getAttachment: vi.fn(),
  viewUrl: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get: blobGet }));
vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/support/tickets", () => ({ createTicketStore: () => ({ getAttachment }) }));
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => ({ viewUrl }) }));

import { GET } from "@/app/api/support/attachments/[messageId]/route";

const request = new Request("http://localhost/api/support/attachments/5");
const context = (messageId: string) => ({ params: Promise.resolve({ messageId }) }) as never;

describe("Ticket attachment route", () => {
  beforeEach(() => {
    process.env.ORDERS_BLOB_READ_WRITE_TOKEN = "test-token";
    currentVisitor.mockReset().mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
    getAttachment.mockReset().mockResolvedValue({ pathname: "ticket-attachments/1/p.png" });
    viewUrl.mockReset().mockResolvedValue("https://files.test/f1?signature=short-lived");
    blobGet.mockReset().mockResolvedValue({
      statusCode: 200,
      stream: new Response("png-bytes").body,
      blob: { contentType: "image/png" },
    });
  });

  test("streams the owned attachment privately", async () => {
    const response = await GET(request, context("5"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe("png-bytes");
    expect(getAttachment).toHaveBeenCalledWith(5, "customer-1");
    expect(blobGet).toHaveBeenCalledWith("ticket-attachments/1/p.png", { access: "private", token: "test-token" });
  });

  test("sends the owner to a short-lived address for an image in file-storage", async () => {
    getAttachment.mockResolvedValue({ fileId: "f1" });

    const response = await GET(request, context("5"));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://files.test/f1?signature=short-lived");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(viewUrl).toHaveBeenCalledWith("f1");
    expect(blobGet).not.toHaveBeenCalled();
  });

  test("says not found when file-storage cannot give an address", async () => {
    getAttachment.mockResolvedValue({ fileId: "f1" });
    viewUrl.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await GET(request, context("5"))).status).toBe(404);
  });

  test("hides the attachment from signed-out visitors, non-owners and bad ids", async () => {
    currentVisitor.mockResolvedValueOnce({ state: "signed-out" });
    expect((await GET(request, context("5"))).status).toBe(404);

    getAttachment.mockResolvedValueOnce(undefined);
    expect((await GET(request, context("5"))).status).toBe(404);

    expect((await GET(request, context("abc"))).status).toBe(404);
    expect(blobGet).not.toHaveBeenCalled();
  });
});
