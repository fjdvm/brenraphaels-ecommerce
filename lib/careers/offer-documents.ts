import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { documentUploadSchema } from "../validators/document";
import type { RequiredDocument } from "./application-offer";
import type { DocumentFiles } from "./document-files";

/** The seven Pre-employment Documents HRMS tracks on an Offer, in HRMS's order. Careers only names them; HRMS decides which are requested. */
export const OFFER_DOCUMENTS = [
  { type: "resume", name: "Resume", hint: "Resume or CV" },
  { type: "valid-id", name: "Valid government ID", hint: "Any government-issued ID" },
  { type: "nbi", name: "NBI clearance", hint: "Not older than 6 months" },
  { type: "health", name: "Health certificate", hint: "From the city health office" },
  { type: "sss", name: "SSS number", hint: "E-1 form or SSS ID" },
  { type: "philhealth", name: "PhilHealth number", hint: "MDR or PhilHealth ID" },
  { type: "pagibig", name: "Pag-IBIG MID and TIN", hint: "For payroll deductions and tax" },
] as const;
export type OfferDocumentType = (typeof OFFER_DOCUMENTS)[number]["type"];
const isOfferDocumentType = (value: unknown): value is OfferDocumentType => OFFER_DOCUMENTS.some((document) => document.type === value);

export const offerDocumentFailedMessage = "We couldn't submit your document. Try again.";
export const offerDocumentUploadedMessage = "Document uploaded.";

/** The Offer and the Documents HRMS asked this Applicant for. Rows HRMS has not requested are never here. */
export type RequestedDocuments = { offerId: number; documents: Array<RequiredDocument & { type: OfferDocumentType }> };

type Row = { offer_id: number; document_type: string; status: string; due_date: string | null };
const undefinedTable = "42P01";

/**
 * The Documents HRMS requested for this Applicant's Offer, read from the shared database (ADR-0001). They show from the time the
 * Offer is Sent; a Document HR re-requested is Requested again. Reads as none until HRMS has created its tables.
 */
export async function readRequestedDocuments<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>, applicantId: string, referenceNumber: string,
): Promise<RequestedDocuments | null> {
  let rows: Row[];
  try {
    const result = await db.execute(sql`
      select o.id as offer_id, d.document_type, d.status, d.due_date::text as due_date
      from applications a
      join hrms_offers o on o.application_id = a.id and o.status in ('Sent', 'Accepted')
      join hrms_offer_documents d on d.offer_id = o.id
      where a.applicant_id = ${applicantId} and a.reference_number = ${referenceNumber}`);
    rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows ?? []) as Row[];
  } catch (error) {
    const code = (error as { code?: unknown; cause?: { code?: unknown } }).code ?? (error as { cause?: { code?: unknown } }).cause?.code;
    if (code === undefinedTable || /hrms_offer.*does not exist/.test(String((error as Error).message))) return null;
    throw error;
  }
  if (!rows.length) return null;
  const documents = OFFER_DOCUMENTS.flatMap((document) => {
    const row = rows.find((item) => item.document_type === document.type);
    if (!row) return [];
    return [{ type: document.type, name: document.name, hint: document.hint, dueDate: row.due_date, status: (row.status === "Submitted" ? "Submitted" : "To upload") as RequiredDocument["status"] }];
  });
  return { offerId: Number(rows[0].offer_id), documents };
}

/** HRMS's endpoint for a submitted document (ADR-0002). Careers never writes the shared tables itself. */
export type OfferDocumentGateway = {
  submit(input: { offerId: number; applicantId: string; type: OfferDocumentType; fileId: string; fileName: string }): Promise<void>;
};

export function hrmsOfferDocumentGateway({
  baseUrl = process.env.HRMS_URL,
  callerKey = process.env.CAREERS_CALLER_KEY,
  fetch: send = fetch,
}: { baseUrl?: string; callerKey?: string; fetch?: typeof fetch } = {}): OfferDocumentGateway {
  return {
    async submit({ offerId, applicantId, type, fileId, fileName }) {
      if (!baseUrl || !callerKey) throw new Error("HRMS is not configured.");
      const response = await send(`${baseUrl.replace(/\/$/, "")}/api/careers/offers/${offerId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, type, fileId, fileName }),
      }).catch(() => { throw new Error(offerDocumentFailedMessage); });
      if (!response.ok) throw new Error(offerDocumentFailedMessage);
    },
  };
}

type Target = { applicantId: string; referenceNumber: string; type: unknown };
type Deps = { files: DocumentFiles; gateway?: OfferDocumentGateway; requested: (applicantId: string, referenceNumber: string) => Promise<RequestedDocuments | null> };

/** The Offer, only when this Document is currently Requested for this Applicant; anything else is refused before a byte moves. */
async function requestedOffer({ applicantId, referenceNumber, type }: Target, deps: Pick<Deps, "requested">) {
  if (!isOfferDocumentType(type)) throw new Error("Choose a valid Document.");
  const found = await deps.requested(applicantId, referenceNumber);
  const document = found?.documents.find((item) => item.type === type);
  if (!found || !document) throw new Error("This Document has not been requested.");
  if (document.status === "Submitted") throw new Error("This Document is already submitted.");
  return { offerId: found.offerId, type };
}

/** Step one: check the file against the existing Careers rules, then ask file-storage for a place to put it. */
export async function prepareOfferDocument(target: Target & { file: unknown }, deps: Pick<Deps, "files" | "requested">) {
  const file = documentUploadSchema.safeParse(target.file);
  if (!file.success) throw new Error(file.error.issues[0].message);
  await requestedOffer(target, deps);
  return deps.files.prepare(file.data);
}

/**
 * Step two, after the browser stored the bytes: confirm the file, then tell HRMS the type and file id. If HRMS is down the
 * Document stays Requested, nothing is recorded and the file is orphaned; the Applicant's retry uploads a fresh one.
 */
export async function submitOfferDocument(target: Target & { fileId: unknown; fileName: unknown }, deps: Required<Pick<Deps, "gateway">> & Deps) {
  const { offerId, type } = await requestedOffer(target, deps);
  if (typeof target.fileId !== "string" || !target.fileId.trim() || typeof target.fileName !== "string" || !target.fileName.trim()) throw new Error("Choose a valid Document.");
  await deps.files.confirm(target.fileId);
  await deps.gateway.submit({ offerId, applicantId: target.applicantId, type, fileId: target.fileId, fileName: target.fileName.trim().slice(0, 255) });
}
