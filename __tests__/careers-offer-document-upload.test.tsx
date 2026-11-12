// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { prepareOfferDocumentUpload, submitOfferDocumentUpload } = vi.hoisted(() => ({ prepareOfferDocumentUpload: vi.fn(), submitOfferDocumentUpload: vi.fn() }));
vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ prepareOfferDocumentUpload, submitOfferDocumentUpload }));
vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ prepareApplicantDocumentUpload: vi.fn(), confirmApplicantDocumentUpload: vi.fn() }));

import { CareersToaster } from "@/app/(careers)/careers/_components/action-toast";
import { UploadDocumentButton } from "@/app/(careers)/careers/_components/upload-document-button";
import type { UploadTransport } from "@/lib/careers/upload-transport";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const transport: UploadTransport = vi.fn().mockResolvedValue(undefined);
const user = () => userEvent.setup({ applyAccept: false });
const pick = async (file: File) => {
  await user().click(screen.getByRole("button", { name: "Upload NBI clearance" }));
  await user().upload(screen.getByLabelText("Choose a file"), file);
};
const renderRow = () => render(<><CareersToaster /><UploadDocumentButton documentName="NBI clearance" dueLabel="20 Nov" transport={transport} offerDocument={{ referenceNumber: "BR-APP-1", type: "nbi" }} /></>);

describe("uploading a requested Document", () => {
  test("stores the file, then tells HRMS the type and file id", async () => {
    prepareOfferDocumentUpload.mockResolvedValue({ fileId: "file-1", uploadUrl: "https://signed.test/u" });
    submitOfferDocumentUpload.mockResolvedValue({ message: "Document uploaded." });
    renderRow();
    await pick(new File(["x"], "nbi.pdf", { type: "application/pdf" }));
    await user().click(screen.getByRole("button", { name: "Submit document" }));
    await waitFor(() => expect(submitOfferDocumentUpload).toHaveBeenCalled());
    expect(prepareOfferDocumentUpload).toHaveBeenCalledWith({ referenceNumber: "BR-APP-1", type: "nbi", name: "nbi.pdf", contentType: "application/pdf", size: 1 });
    expect(submitOfferDocumentUpload).toHaveBeenCalledWith({ referenceNumber: "BR-APP-1", type: "nbi", fileId: "file-1", fileName: "nbi.pdf" });
  });

  test("a failed HRMS call shows try again, keeps the file for Retry and records nothing", async () => {
    prepareOfferDocumentUpload.mockResolvedValue({ fileId: "file-1", uploadUrl: "https://signed.test/u" });
    submitOfferDocumentUpload.mockResolvedValue({ message: "We couldn't submit your document. Try again." });
    renderRow();
    await pick(new File(["x"], "nbi.pdf", { type: "application/pdf" }));
    await user().click(screen.getByRole("button", { name: "Submit document" }));
    expect((await screen.findAllByRole("button", { name: "Retry" })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("We couldn't submit your document. Try again.")).length).toBeGreaterThan(0);
  });

  test("a wrong type is rejected in the browser, before any request", async () => {
    renderRow();
    await pick(new File(["x"], "nbi.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    expect(await screen.findByText(/PDF, JPG or PNG file/)).toBeTruthy();
    expect(prepareOfferDocumentUpload).not.toHaveBeenCalled();
  });
});
