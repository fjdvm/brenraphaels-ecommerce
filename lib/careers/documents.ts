import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { documentUploadSchema } from "../validators/document";
import type { DocumentFiles } from "./document-files";
import { applicantDocuments } from "./schema";

type DocumentMetadata = { name: string; contentType: string; size: number };
export type ApplicantDocumentStore = {
  pending(document: DocumentMetadata & { applicantId: string; fileId: string }): Promise<number>;
  find(id: number, applicantId: string): Promise<{ fileId: string | null; confirmedAt: Date | null } | undefined>;
  markUsable(id: number, applicantId: string): Promise<void>;
  list(applicantId: string): Promise<Array<DocumentMetadata & { id: number }>>;
};
export function createApplicantDocumentStore<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(db: PgDatabase<TQueryResult, TSchema>): ApplicantDocumentStore {
  return {
    async pending(document) {
      const [saved] = await db.insert(applicantDocuments).values(document).returning({ id: applicantDocuments.id });
      return saved.id;
    },
    async find(id, applicantId) {
      const [document] = await db.select({ fileId: applicantDocuments.fileId, confirmedAt: applicantDocuments.confirmedAt }).from(applicantDocuments)
        .where(and(eq(applicantDocuments.id, id), eq(applicantDocuments.applicantId, applicantId)));
      return document;
    },
    async markUsable(id, applicantId) {
      await db.update(applicantDocuments).set({ confirmedAt: new Date() })
        .where(and(eq(applicantDocuments.id, id), eq(applicantDocuments.applicantId, applicantId)));
    },
    async list(applicantId) {
      return db.select({ id: applicantDocuments.id, name: applicantDocuments.name, contentType: applicantDocuments.contentType, size: applicantDocuments.size })
        .from(applicantDocuments).where(and(eq(applicantDocuments.applicantId, applicantId), isNotNull(applicantDocuments.fileId), isNotNull(applicantDocuments.confirmedAt)))
        .orderBy(asc(applicantDocuments.id));
    },
  };
}

type Dependencies = { applicantId: string; store: ApplicantDocumentStore; files: DocumentFiles };
export async function prepareApplicantDocument(input: unknown, { applicantId, store, files }: Dependencies) {
  const parsed = documentUploadSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const pending = await files.prepare(parsed.data);
  const documentId = await store.pending({ ...parsed.data, applicantId, fileId: pending.fileId });
  return { documentId, uploadUrl: pending.uploadUrl };
}
export async function confirmApplicantDocument(id: unknown, { applicantId, store, files }: Dependencies) {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a valid Document.");
  const document = await store.find(id, applicantId);
  if (!document?.fileId) throw new Error("Document not found.");
  if (document.confirmedAt) return;
  await files.confirm(document.fileId);
  await files.link(document.fileId, id);
  await store.markUsable(id, applicantId);
}
