import { beforeEach, describe, expect, test, vi } from "vitest";

const { currentVisitor, listCustomerReturns, viewUrl } = vi.hoisted(() => ({
  currentVisitor: vi.fn(), listCustomerReturns: vi.fn(), viewUrl: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/returns/customer-reads", () => ({ listCustomerReturns }));
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => ({ viewUrl }) }));

import { GET } from "@/app/api/returns/[id]/refund-proof/route";

const request = new Request("http://localhost/api/returns/4/refund-proof");
const context = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

describe("Refund proof route", () => {
  beforeEach(() => {
    currentVisitor.mockReset().mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
    listCustomerReturns.mockReset().mockResolvedValue([{ id: 4, refundProofFileId: "proof-1" }, { id: 5, refundProofFileId: null }]);
    viewUrl.mockReset().mockResolvedValue("https://files.test/proof-1?signature=short");
  });

  test("sends the owner to a short-lived address", async () => {
    const response = await GET(request, context("4"));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://files.test/proof-1?signature=short");
    expect(listCustomerReturns).toHaveBeenCalledWith(undefined, "customer-1");
  });

  test.each([["a Return without proof", "5"], ["another Customer's Return", "9"], ["a bad id", "x"]])("404s for %s", async (_name, id) => {
    expect((await GET(request, context(id))).status).toBe(404);
  });

  test("404s for visitors who are not Customers", async () => {
    currentVisitor.mockResolvedValue({ state: "guest" });

    expect((await GET(request, context("4"))).status).toBe(404);
  });

  test("404s when file-storage is unreachable", async () => {
    viewUrl.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await GET(request, context("4"))).status).toBe(404);
  });
});
