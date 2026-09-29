import { beforeEach, describe, expect, test, vi } from "vitest";

const { blobGet, currentVisitor, getAttachmentPathname } = vi.hoisted(() => ({
  blobGet: vi.fn(),
  currentVisitor: vi.fn(),
  getAttachmentPathname: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get: blobGet }));
vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/support/tickets", () => ({ createTicketStore: () => ({ getAttachmentPathname }) }));

import { GET } from "@/app/api/support/attachments/[messageId]/route";

const request = new Request("http://localhost/api/support/attachments/5");
const context = (messageId: string) => ({ params: Promise.resolve({ messageId }) }) as never;

describe("Ticket attachment route", () => {
  beforeEach(() => {
    process.env.ORDERS_BLOB_READ_WRITE_TOKEN = "test-token";
    currentVisitor.mockReset().mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
    getAttachmentPathname.mockReset().mockResolvedValue("ticket-attachments/1/p.png");
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
    expect(getAttachmentPathname).toHaveBeenCalledWith(5, "customer-1");
    expect(blobGet).toHaveBeenCalledWith("ticket-attachments/1/p.png", { access: "private", token: "test-token" });
  });

  test("hides the attachment from signed-out visitors, non-owners and bad ids", async () => {
    currentVisitor.mockResolvedValueOnce({ state: "signed-out" });
    expect((await GET(request, context("5"))).status).toBe(404);

    getAttachmentPathname.mockResolvedValueOnce(undefined);
    expect((await GET(request, context("5"))).status).toBe(404);

    expect((await GET(request, context("abc"))).status).toBe(404);
    expect(blobGet).not.toHaveBeenCalled();
  });
});
