import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createApplicantDocumentStore, uploadApplicantDocument } from "../lib/careers/documents";

let client: PGlite;
beforeEach(async () => { client = new PGlite(); await client.exec("create table applicant_documents (id integer generated always as identity primary key, applicant_id text not null, name text not null, content_type text not null, size integer not null, blob_pathname text not null unique, created_at timestamptz not null default now())"); });
afterEach(async () => client.close());

test("stores a permitted Document privately and records it under the Applicant", async () => {
  const put = vi.fn().mockResolvedValue({ pathname: "applicants/a-1/resume.pdf" });
  await uploadApplicantDocument(new File(["resume"], "resume.pdf", { type: "application/pdf" }), { applicantId: "a-1", store: createApplicantDocumentStore(drizzle(client)), put });
  expect(put).toHaveBeenCalledWith("applicants/a-1/resume.pdf", expect.any(File), { access: "private", addRandomSuffix: true });
  expect((await client.query("select applicant_id, name, content_type from applicant_documents")).rows).toEqual([{ applicant_id: "a-1", name: "resume.pdf", content_type: "application/pdf" }]);
});

test("rejects an unsafe type before writing a Blob or profile record", async () => {
  const put = vi.fn();
  await expect(uploadApplicantDocument(new File(["bad"], "virus.exe", { type: "application/octet-stream" }), { applicantId: "a-1", store: createApplicantDocumentStore(drizzle(client)), put })).rejects.toThrow("PDF, Word document, or image");
  expect(put).not.toHaveBeenCalled();
});
