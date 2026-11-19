import { cleanFileName } from "../validators/sanitize";
import type { TicketFiles } from "../support/ticket-files";
import type { SeniorPwdApplication } from "./application-schema";
import { SeniorPwdConflict, latestVerification, submitVerification, type Verification } from "./store";

export * from "./application-schema";

export type SeniorPwdSubmitOutcome =
  | { status: "submitted" }
  | { status: "not-needed"; verification: Verification }
  | { status: "id-in-use" }
  | { status: "failed" };

type Db = Parameters<typeof latestVerification>[0];

/**
 * Sends the Customer's ID for Staff review. Photos go to file-storage as Private, Temporary Files (removed after 7 days
 * if nobody reviews them). An ID already approved or waiting for review is left alone, and one already used on another
 * account is refused. Never throws for these: the caller decides what to tell the Customer.
 */
export async function submitSeniorPwdApplication(
  db: Db,
  customerId: string,
  application: SeniorPwdApplication,
  files: Pick<TicketFiles, "upload" | "remove">,
): Promise<SeniorPwdSubmitOutcome> {
  const latest = await latestVerification(db, customerId);
  if (latest && (latest.status === "approved" || latest.status === "pending")) return { status: "not-needed", verification: latest };

  const uploaded: string[] = [];
  const store = async (file: File) => {
    const id = await files.upload({
      filename: cleanFileName(file.name), contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()), retentionType: "temporary",
    });
    uploaded.push(id);
    return id;
  };
  try {
    const photoFileId = await store(application.front);
    const photoBackFileId = application.back ? await store(application.back) : undefined;
    await submitVerification(db, customerId, { idType: application.idType, idNumber: application.idNumber, photoFileId, photoBackFileId });
    return { status: "submitted" };
  } catch (error) {
    // Nothing was kept for review, so the photos must not linger.
    await Promise.all(uploaded.map((id) => files.remove(id).catch(() => undefined)));
    if (error instanceof SeniorPwdConflict) return { status: "id-in-use" };
    console.error("A Senior/PWD ID could not be submitted", error);
    return { status: "failed" };
  }
}

/** The sentence to show a Customer whose ID could not be sent, or undefined when it was sent or needed no sending. */
export function applicationProblem(outcome: SeniorPwdSubmitOutcome): string | undefined {
  if (outcome.status === "id-in-use") return "That ID is already used on another account, so we couldn't send it for review.";
  if (outcome.status === "failed") return "We couldn't send your ID for review right now.";
  return undefined;
}
