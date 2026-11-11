// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { prepareApplicantDocumentUpload, confirmApplicantDocumentUpload } = vi.hoisted(() => ({
  prepareApplicantDocumentUpload: vi.fn(),
  confirmApplicantDocumentUpload: vi.fn(),
}));
vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ prepareApplicantDocumentUpload, confirmApplicantDocumentUpload, submitApplicantProfile: vi.fn() }));

import { CareersToaster } from "@/app/(careers)/careers/_components/action-toast";
import { UploadDocumentDialog } from "@/app/(careers)/careers/_components/upload-document-dialog";
import { UploadCancelled, type UploadTransport } from "@/lib/careers/upload-transport";

const MB = 1024 * 1024;
const fileOf = (name: string, type: string, size: number) => new File([new Uint8Array(Math.round(size))], name, { type });
const user = () => userEvent.setup({ applyAccept: false });
const picker = () => screen.getByLabelText("Choose a file") as HTMLInputElement;

type Gate = { progress: (loaded: number, total: number) => void; finish: () => void; fail: () => void };
let gate: Gate;
const transport: UploadTransport = (_url, _file, { onProgress, signal }) =>
  new Promise<void>((resolve, reject) => {
    gate = {
      progress: (loaded, total) => onProgress?.({ loaded, total }),
      finish: resolve,
      fail: () => reject(new Error("offline")),
    };
    signal?.addEventListener("abort", () => reject(new UploadCancelled()));
  });

function renderDialog(onUploaded = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <>
      <CareersToaster />
      <UploadDocumentDialog open onOpenChange={onOpenChange} documentName="NBI clearance" dueLabel="13 Nov" hint="Not older than 6 months" onUploaded={onUploaded} transport={transport} />
    </>,
  );
  return { onUploaded, onOpenChange };
}

beforeEach(() => {
  prepareApplicantDocumentUpload.mockReset().mockResolvedValue({ documentId: 7, uploadUrl: "https://files.test/up" });
  confirmApplicantDocumentUpload.mockReset().mockResolvedValue({ message: "Document uploaded." });
});
afterEach(() => {
  act(() => { toast.dismiss(); });
  cleanup();
});

describe("Upload document dialog", () => {
  test("names the Document, its due date and the allowed formats", () => {
    renderDialog();
    expect(screen.getByText("Upload NBI clearance")).toBeTruthy();
    expect(screen.getByText("Due 13 Nov · Not older than 6 months · PDF, JPG or PNG up to 10 MB")).toBeTruthy();
    expect(picker().accept).toContain(".pdf");
    expect(picker().accept).not.toMatch(/doc|word/i);
    expect(screen.getByText(/Blurry files may be sent back/)).toBeTruthy();
    expect(screen.getByText("Our team checks it within 1 working day.")).toBeTruthy();
  });

  test.each([
    ["a Word file", fileOf("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10), "Upload a PDF, JPG or PNG file. Word documents and other formats are not accepted."],
    ["any other format", fileOf("run.exe", "application/octet-stream", 10), "Upload a PDF, JPG or PNG file. Word documents and other formats are not accepted."],
    ["a file over the limit", fileOf("big.pdf", "application/pdf", 10 * MB + 1), "Documents must be 10 MB or smaller."],
  ])("refuses %s with a message and never starts an upload", async (_name, file, message) => {
    renderDialog();
    await user().upload(picker(), file);
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(prepareApplicantDocumentUpload).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Submit document" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("accepts a PDF of exactly 10 MB", async () => {
    renderDialog();
    await user().upload(picker(), fileOf("nbi.pdf", "application/pdf", 10 * MB));
    expect(screen.getByText("nbi.pdf")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Submit document" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("a chosen file can be removed before submitting", async () => {
    renderDialog();
    const u = user();
    await u.upload(picker(), fileOf("nbi.png", "image/png", 100));
    await u.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByText("nbi.png")).toBeNull();
    expect((screen.getByRole("button", { name: "Submit document" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("shows the real byte counts and percentage in the dialog and in the card, then the result", async () => {
    const { onUploaded } = renderDialog();
    const u = user();
    await u.upload(picker(), fileOf("nbi.jpg", "image/jpeg", 2.8 * MB));
    await u.click(screen.getByRole("button", { name: "Submit document" }));
    await waitFor(() => expect(gate).toBeDefined());

    act(() => gate.progress(Math.round(1.8 * MB), Math.round(2.8 * MB)));
    expect(await screen.findByText("1.8 MB of 2.8 MB · 64%")).toBeTruthy();
    const bars = screen.getAllByRole("progressbar");
    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual(expect.arrayContaining(["64"]));
    expect(await screen.findByText("Uploading… 64%")).toBeTruthy();

    await act(async () => { gate.finish(); });
    expect(await screen.findByText("Document uploaded")).toBeTruthy();
    expect(prepareApplicantDocumentUpload).toHaveBeenCalledWith({ name: "nbi.jpg", contentType: "image/jpeg", size: Math.round(2.8 * MB) });
    expect(confirmApplicantDocumentUpload).toHaveBeenCalledWith(7);
    expect(onUploaded).toHaveBeenCalled();
  });

  test("cancelling stops the upload, clears the card and never confirms", async () => {
    renderDialog();
    const u = user();
    await u.upload(picker(), fileOf("nbi.pdf", "application/pdf", 1000));
    await u.click(screen.getByRole("button", { name: "Submit document" }));
    await waitFor(() => expect(gate).toBeDefined());
    await u.click(screen.getByRole("button", { name: "Cancel upload" }));
    await waitFor(() => expect(screen.queryByText(/Uploading…/)).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(confirmApplicantDocumentUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit document" })).toBeTruthy();
  });

  test("an interrupted upload says so, can be retried and then succeeds", async () => {
    const { onUploaded } = renderDialog();
    const u = user();
    await u.upload(picker(), fileOf("nbi.pdf", "application/pdf", 1000));
    await u.click(screen.getByRole("button", { name: "Submit document" }));
    await waitFor(() => expect(gate).toBeDefined());
    await act(async () => { gate.fail(); });
    expect((await screen.findAllByText("We couldn't upload that Document. Try again.")).length).toBeGreaterThan(0);
    expect(onUploaded).not.toHaveBeenCalled();
    expect(confirmApplicantDocumentUpload).not.toHaveBeenCalled();

    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(prepareApplicantDocumentUpload).toHaveBeenCalledTimes(2));
    await act(async () => { gate.finish(); });
    expect(await screen.findByText("Document uploaded")).toBeTruthy();
    expect(onUploaded).toHaveBeenCalled();
  });

  test("a file the browser reports without a type is accepted by its extension", async () => {
    renderDialog();
    await user().upload(picker(), fileOf("scan.pdf", "", 100));
    expect(screen.getByText("scan.pdf")).toBeTruthy();
  });

  test("the mobile sheet offers camera, gallery and file", () => {
    renderDialog();
    for (const text of ["Take a photo", "Choose from gallery", "Upload a file"]) expect(screen.getByText(text)).toBeTruthy();
    expect((screen.getByLabelText("Take a photo") as HTMLInputElement).getAttribute("capture")).toBe("environment");
  });
});
