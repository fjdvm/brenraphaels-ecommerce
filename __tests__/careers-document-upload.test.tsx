// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { prepareApplicantDocumentUpload, confirmApplicantDocumentUpload } = vi.hoisted(() => ({
  prepareApplicantDocumentUpload: vi.fn(),
  confirmApplicantDocumentUpload: vi.fn(),
}));

vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({
  submitApplicantProfile: vi.fn(),
  prepareApplicantDocumentUpload,
  confirmApplicantDocumentUpload,
}));
vi.mock("@/app/(careers)/careers/(portal)/profile/job-alerts-toggle", () => ({ JobAlertsToggle: () => null }));

import { ApplicantProfileForm } from "@/app/(careers)/careers/(portal)/profile/applicant-profile-form";

const profile = { fullName: "Mylene Santos", phone: "", location: "", summary: "", skills: "", education: [], workHistory: [] };
const pdf = () => new File(["%PDF"], "Resume.pdf", { type: "application/pdf" });
const put = vi.fn();

beforeEach(() => {
  prepareApplicantDocumentUpload.mockReset().mockResolvedValue({ documentId: 7, uploadUrl: "https://files.test/file-1/upload?signed" });
  confirmApplicantDocumentUpload.mockReset().mockResolvedValue({ message: "Document uploaded." });
  put.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", put);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm(documents: Array<{ id: number; name: string; contentType: string; size: number }> = []) {
  return render(<ApplicantProfileForm heading="Your profile" fullName="Mylene Santos" profile={profile} documents={documents} />);
}
const input = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("Applicant uploads a Document", () => {
  test("asks for an upload address, PUTs the file to it, confirms, then says so", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(input(), pdf());

    expect(await screen.findByText("Document uploaded.")).toBeTruthy();
    expect(prepareApplicantDocumentUpload).toHaveBeenCalledWith({ name: "Resume.pdf", contentType: "application/pdf", size: 4 });
    expect(put).toHaveBeenCalledWith("https://files.test/file-1/upload?signed", expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/pdf" } }));
    expect(confirmApplicantDocumentUpload).toHaveBeenCalledWith(7);
  });

  test("shows the Document uploading until the steps finish", async () => {
    let finish: (value: { ok: boolean }) => void = () => {};
    put.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(input(), pdf());
    expect(await screen.findByText("Uploading…")).toBeTruthy();

    finish({ ok: true });
    expect(await screen.findByText("Document uploaded.")).toBeTruthy();
    expect(screen.queryByText("Uploading…")).toBeNull();
  });

  test.each([
    ["wrong type", () => prepareApplicantDocumentUpload.mockResolvedValue({ message: "Upload a PDF, JPG or PNG file." }), "Upload a PDF, JPG or PNG file."],
    ["failed confirm", () => confirmApplicantDocumentUpload.mockResolvedValue({ message: "We couldn't upload that Document. Try again." }), "We couldn't upload that Document. Try again."],
    ["failed PUT", () => put.mockResolvedValue({ ok: false }), "We couldn't upload that Document. Try again."],
    ["network error on PUT", () => put.mockRejectedValue(new Error("offline")), "We couldn't upload that Document. Try again."],
  ])("shows a message for %s and does not claim success", async (_name, arrange, message) => {
    arrange();
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(input(), pdf());

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText("Document uploaded.")).toBeNull();
  });

  test("an empty file is rejected without asking for an upload address", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(input(), new File([], "Empty.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Choose a file to upload.")).toBeTruthy();
    expect(prepareApplicantDocumentUpload).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test("a failed upload never confirms", async () => {
    put.mockResolvedValue({ ok: false });
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    await user.upload(input(), pdf());
    await waitFor(() => expect(put).toHaveBeenCalled());

    expect(confirmApplicantDocumentUpload).not.toHaveBeenCalled();
  });

  test("lists each Document with its name and size", () => {
    renderForm([{ id: 1, name: "Resume.pdf", contentType: "application/pdf", size: 2048 }]);
    expect(screen.getByText("Resume.pdf")).toBeTruthy();
    expect(screen.getByText(/2 KB/)).toBeTruthy();
  });
});
