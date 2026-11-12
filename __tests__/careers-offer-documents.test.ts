import { describe, expect, test, vi } from "vitest";

import { hrmsOfferDocumentGateway, prepareOfferDocument, submitOfferDocument, type RequestedDocuments } from "@/lib/careers/offer-documents";
import type { DocumentFiles } from "@/lib/careers/document-files";

const requested = (status: "To upload" | "Submitted" = "To upload"): RequestedDocuments => ({
  offerId: 7,
  documents: [{ type: "nbi", name: "NBI clearance", status, dueDate: "2026-11-20" }],
});
const fakeFiles = (): DocumentFiles => ({
  prepare: vi.fn().mockResolvedValue({ fileId: "file-1", uploadUrl: "https://signed.test/u" }),
  confirm: vi.fn().mockResolvedValue(undefined),
  link: vi.fn(),
  viewUrl: vi.fn(),
});
const pdf = { name: "nbi.pdf", contentType: "application/pdf", size: 1000 };
const target = { applicantId: "app-1", referenceNumber: "BR-APP-1", type: "nbi" };

describe("preparing an Offer document", () => {
  test("asks file-storage for a place only for a Requested Document", async () => {
    const files = fakeFiles();
    const found = await prepareOfferDocument({ ...target, file: pdf }, { files, requested: async () => requested() });
    expect(found).toEqual({ fileId: "file-1", uploadUrl: "https://signed.test/u" });
  });

  test.each([
    ["a Word file", { ...pdf, name: "nbi.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, "PDF, JPG or PNG"],
    ["an oversize file", { ...pdf, size: 11 * 1024 * 1024 }, "10 MB"],
  ])("rejects %s before anything is sent", async (_name, file, message) => {
    const files = fakeFiles();
    await expect(prepareOfferDocument({ ...target, file }, { files, requested: async () => requested() })).rejects.toThrow(message);
    expect(files.prepare).not.toHaveBeenCalled();
  });

  test.each([
    ["not requested", null],
    ["already submitted", requested("Submitted")],
  ])("refuses a Document that is %s", async (_name, found) => {
    const files = fakeFiles();
    await expect(prepareOfferDocument({ ...target, file: pdf }, { files, requested: async () => found })).rejects.toThrow();
    expect(files.prepare).not.toHaveBeenCalled();
  });

  test("refuses an unknown type", async () => {
    await expect(prepareOfferDocument({ ...target, type: "passport", file: pdf }, { files: fakeFiles(), requested: async () => requested() })).rejects.toThrow("valid Document");
  });
});

describe("submitting an Offer document", () => {
  test("confirms the file then tells HRMS the type and file id", async () => {
    const files = fakeFiles();
    const gateway = { submit: vi.fn().mockResolvedValue(undefined) };
    await submitOfferDocument({ ...target, fileId: "file-1", fileName: "nbi.pdf" }, { files, gateway, requested: async () => requested() });
    expect(files.confirm).toHaveBeenCalledWith("file-1");
    expect(gateway.submit).toHaveBeenCalledWith({ offerId: 7, applicantId: "app-1", type: "nbi", fileId: "file-1", fileName: "nbi.pdf" });
  });

  test("a failed HRMS call surfaces so the row stays Requested", async () => {
    const gateway = { submit: vi.fn().mockRejectedValue(new Error("down")) };
    await expect(submitOfferDocument({ ...target, fileId: "file-1", fileName: "nbi.pdf" }, { files: fakeFiles(), gateway, requested: async () => requested() })).rejects.toThrow("down");
  });

  test("tells HRMS nothing for a Document that is not Requested", async () => {
    const gateway = { submit: vi.fn() };
    await expect(submitOfferDocument({ ...target, fileId: "file-1", fileName: "nbi.pdf" }, { files: fakeFiles(), gateway, requested: async () => requested("Submitted") })).rejects.toThrow();
    expect(gateway.submit).not.toHaveBeenCalled();
  });
});

describe("HRMS gateway", () => {
  const input = { offerId: 7, applicantId: "app-1", type: "nbi" as const, fileId: "file-1", fileName: "nbi.pdf" };

  test("posts to the Offer's documents route with the Careers caller key", async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    await hrmsOfferDocumentGateway({ baseUrl: "https://hrms.test/", callerKey: "key", fetch: send }).submit(input);
    expect(send.mock.calls[0][0]).toBe("https://hrms.test/api/careers/offers/7/documents");
    expect(send.mock.calls[0][1]!.headers).toEqual({ Authorization: "Bearer key", "Content-Type": "application/json" });
    expect(JSON.parse(send.mock.calls[0][1]!.body as string)).toEqual({ applicantId: "app-1", type: "nbi", fileId: "file-1", fileName: "nbi.pdf" });
  });

  test.each([[503], [409]])("a %s answer is a failure", async (status) => {
    const send = vi.fn().mockResolvedValue(Response.json({ error: "x" }, { status }));
    await expect(hrmsOfferDocumentGateway({ baseUrl: "https://hrms.test", callerKey: "key", fetch: send }).submit(input)).rejects.toThrow("Try again");
  });

  test("an unreachable HRMS is a retryable failure, and missing configuration sends nothing", async () => {
    await expect(hrmsOfferDocumentGateway({ baseUrl: "https://hrms.test", callerKey: "key", fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")) }).submit(input)).rejects.toThrow("Try again");
    const send = vi.fn();
    await expect(hrmsOfferDocumentGateway({ baseUrl: undefined, callerKey: "key", fetch: send }).submit(input)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
