import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { FakeDocumentFiles } from "./fake-document-files";

const mocks = vi.hoisted(() => ({ session: vi.fn(), database: vi.fn(), files: vi.fn() }));
vi.mock("@/lib/careers/auth", () => ({ careersSession: mocks.session }));
vi.mock("@/lib/careers/db", () => ({ getCareersDatabase: mocks.database }));
vi.mock("@/lib/careers/document-files", () => ({ gatewayDocumentFiles: mocks.files }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { prepareApplicantDocumentUpload, confirmApplicantDocumentUpload, openApplicantDocumentLink } from "@/app/(careers)/careers/(portal)/profile/actions";

import { submitApplicantDocument } from "@/app/(careers)/careers/(portal)/profile/document-upload";

let client: PGlite;
let files: FakeDocumentFiles;
let store: ReturnType<typeof createApplicantDocumentStore>;
beforeEach(async () => {
  client = new PGlite();
  await client.exec("create table applicant_documents (id integer generated always as identity primary key, applicant_id text not null, name text not null, content_type text not null, size integer not null, file_id text unique, confirmed_at timestamptz, created_at timestamptz not null default now())");
  files = new FakeDocumentFiles();
  const db = drizzle(client);
  store = createApplicantDocumentStore(db);
  mocks.database.mockReturnValue(db);
  mocks.session.mockResolvedValue({ userId: "a-1" });
  mocks.files.mockReturnValue(files);
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "caller");
});
afterEach(async () => { await client.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const pdf = { name: "resume.pdf", contentType: "application/pdf", size: 10 };
test.each([
  ["resume.pdf", "application/pdf"],
  ["photo.jpg", "image/jpeg"], ["photo.PNG", "image/png"],
])("only lists %s after confirmation and linking", async (name, contentType) => {
  const pending = await prepareApplicantDocumentUpload({ ...pdf, name, contentType });
  expect(pending).toEqual({ documentId: 1, uploadUrl: "https://files.test/file-1/upload?signed" });
  expect(await store.list("a-1")).toEqual([]);
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Document uploaded." });
  expect(await store.list("a-1")).toEqual([{ id: 1, name, contentType, size: 10 }]);
  expect(await store.list("another-applicant")).toEqual([]);
  expect(files.files.get("file-1")).toMatchObject({ visibility: "private", retentionType: "permanent", confirmed: true, documentId: 1 });
  expect((await store.find(1, "a-1"))?.fileId).toBe("file-1");
});

test.each([
  [{ ...pdf, contentType: "application/octet-stream" }, "PDF, JPG or PNG"],
  [{ name: "resume.doc", contentType: "application/msword", size: 10 }, "PDF, JPG or PNG"],
  [{ name: "resume.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 }, "PDF, JPG or PNG"],
  [{ ...pdf, name: "virus.exe" }, "extension must match"],
  [{ ...pdf, name: "image.png" }, "extension must match"],
  [{ ...pdf, size: 0 }, "Choose a file"],
  [{ ...pdf, size: 10 * 1024 * 1024 + 1 }, "Documents must be 10 MB or smaller."],
  [{ ...pdf, name: "../resume.pdf" }, "Use letters"],
  [{ ...pdf, name: "a\u0000.pdf" }, "invisible"],
  [{ ...pdf, contentType: "application/p\u200bdf" }, "invisible"],
])("refuses invalid metadata before creating a File", async (input, message) => {
  expect(await prepareApplicantDocumentUpload(input)).toEqual({ message: expect.stringContaining(message) });
  expect(files.files.size).toBe(0);
  expect(await store.list("a-1")).toEqual([]);
});

test.each(["failConfirm", "failLink"] as const)("%s leaves the Document pending and allows retry", async (failure) => {
  await prepareApplicantDocumentUpload(pdf);
  files[failure] = true;
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: expect.stringContaining("failed") });
  expect(await store.list("a-1")).toEqual([]);
  files[failure] = false;
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Document uploaded." });
  expect(await store.list("a-1")).toHaveLength(1);
});

test("refuses another Applicant's confirmation and invalid ids", async () => {
  await prepareApplicantDocumentUpload(pdf);
  mocks.session.mockResolvedValue({ userId: "a-2" });
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Document not found." });
  expect(await confirmApplicantDocumentUpload("1")).toEqual({ message: "Choose a valid Document." });
  expect(files.files.get("file-1")?.confirmed).toBe(false);
});

test.each(["API_GATEWAY_URL", "API_GATEWAY_CALLER_KEY"])("missing %s gives the configuration message", async (key) => {
  vi.stubEnv(key, "");
  expect(await prepareApplicantDocumentUpload(pdf)).toEqual({ message: "Document uploads are not configured yet." });
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Document uploads are not configured yet." });
});

test("both steps require a signed-in Applicant", async () => {
  mocks.session.mockResolvedValue(null);
  expect(await prepareApplicantDocumentUpload(pdf)).toEqual({ message: "Please sign in to upload a Document." });
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Please sign in to upload a Document." });
  expect(files.files.size).toBe(0);
});

test("the browser uploads exactly 10 MB only to the signed address then confirms", async () => {
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", send);
  const form = new FormData();
  form.set("document", new File([new Uint8Array(10 * 1024 * 1024)], "resume.pdf", { type: "application/pdf" }));
  expect(await submitApplicantDocument({}, form)).toEqual({ message: "Document uploaded." });
  expect(send).toHaveBeenCalledWith("https://files.test/file-1/upload?signed", { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: expect.any(File) });
  expect(await store.list("a-1")).toHaveLength(1);
});

test("accepts exactly 10 MB through preparation and confirmation", async () => {
  const pending = await prepareApplicantDocumentUpload({ ...pdf, size: 10 * 1024 * 1024 });
  expect(pending).toEqual({ documentId: 1, uploadUrl: "https://files.test/file-1/upload?signed" });
  expect(await confirmApplicantDocumentUpload(1)).toEqual({ message: "Document uploaded." });
  expect(await store.list("a-1")).toEqual([{ ...pdf, id: 1, size: 10 * 1024 * 1024 }]);
});

test("an oversized or unsupported file is rejected without any upload request", async () => {
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  for (const file of [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }), new File(["x"], "run.exe", { type: "application/octet-stream" })]) {
    const form = new FormData();
    form.set("document", file);
    expect(await submitApplicantDocument({}, form)).toEqual({ message: expect.any(String) });
  }
  expect(send).not.toHaveBeenCalled();
  expect(files.files.size).toBe(0);
});

test("a failed browser upload leaves the Document unlisted and unconfirmed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  const form = new FormData();
  form.set("document", new File(["x"], "resume.pdf", { type: "application/pdf" }));
  expect(await submitApplicantDocument({}, form)).toEqual({ message: "We couldn't upload that Document. Try again." });
  expect(await store.list("a-1")).toEqual([]);
  expect(files.files.get("file-1")?.confirmed).toBe(false);
});

test("file-storage being down while preparing gives a retryable message and leaves no Document", async () => {
  files.prepare = async () => { throw new Error("We couldn't upload that Document. Try again."); };
  expect(await prepareApplicantDocumentUpload(pdf)).toEqual({ message: "We couldn't upload that Document. Try again." });
  expect(await store.list("a-1")).toEqual([]);
});

test("opening a confirmed Document returns a fresh short-lived link each time", async () => {
  await prepareApplicantDocumentUpload(pdf);
  await confirmApplicantDocumentUpload(1);
  expect(await openApplicantDocumentLink(1)).toEqual({ url: "https://files.test/file-1/view?signed&expires=60" });
  await openApplicantDocumentLink(1);
  expect(files.viewed).toEqual(["file-1", "file-1"]);
});

test("another Applicant's, unconfirmed and invalid Documents are never linked", async () => {
  await prepareApplicantDocumentUpload(pdf);
  expect(await openApplicantDocumentLink(1)).toEqual({ message: "Document not found." });
  await confirmApplicantDocumentUpload(1);
  mocks.session.mockResolvedValue({ userId: "a-2" });
  expect(await openApplicantDocumentLink(1)).toEqual({ message: "Document not found." });
  expect(await openApplicantDocumentLink("1")).toEqual({ message: "Choose a valid Document." });
  mocks.session.mockResolvedValue(null);
  expect(await openApplicantDocumentLink(1)).toEqual({ message: "Please sign in to open a Document." });
  expect(files.viewed).toEqual([]);
});

test("a files gateway failure gives a retryable message", async () => {
  await prepareApplicantDocumentUpload(pdf);
  await confirmApplicantDocumentUpload(1);
  files.failView = true;
  expect(await openApplicantDocumentLink(1)).toEqual({ message: "We couldn't open that Document. Try again." });
  files.failView = false;
  expect(await openApplicantDocumentLink(1)).toEqual({ url: expect.stringContaining("signed") });
});
