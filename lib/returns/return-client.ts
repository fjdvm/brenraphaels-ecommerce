import type { RefundDestinationValues } from "./refund-destination";
import type { PreferredResolution, ReturnReason } from "./return-form";

type Evidence = File;
export type ReturnSubmission = {
  orderId: number;
  orderLineIds: number[];
  reason: ReturnReason;
  note: string;
  preferredResolution: PreferredResolution;
  /** Sent only for a refund, and only once the Customer confirmed it. */
  refundDestination?: RefundDestinationValues & { confirmed: boolean };
  photos: Evidence[];
  video: Evidence | null;
};

export type ReturnResult = { ok: true; number: string } | { ok: false; message: string };

const failed = "We couldn't send your Return request. Please check your connection and try again.";

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : failed;
}

async function postJson(send: typeof fetch, url: string, body: unknown) {
  return send(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** Uploads each file straight to storage, then submits the Return with the signed upload tokens. */
export async function submitReturn(submission: ReturnSubmission, send: typeof fetch = fetch): Promise<ReturnResult> {
  try {
    const tokens = async (file: Evidence, role: "photo" | "video") => {
      const prepared = await postJson(send, `/api/orders/${submission.orderId}/returns/uploads`,
        { role, contentType: file.type, size: file.size });
      if (!prepared.ok) throw new Error(await readError(prepared));
      const { uploadUrl, uploadToken } = await prepared.json();
      const put = await send(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("A file could not be uploaded. Please try again.");
      return uploadToken as string;
    };
    const photoUploadTokens = [];
    for (const photo of submission.photos) photoUploadTokens.push(await tokens(photo, "photo"));
    const videoUploadToken = submission.video ? await tokens(submission.video, "video") : undefined;
    const response = await postJson(send, `/api/orders/${submission.orderId}/returns`, {
      orderLineIds: submission.orderLineIds, reason: submission.reason, note: submission.note,
      preferredResolution: submission.preferredResolution, photoUploadTokens,
      ...(submission.refundDestination ? { refundDestination: submission.refundDestination } : {}), ...(videoUploadToken ? { videoUploadToken } : {}),
    });
    if (!response.ok) return { ok: false, message: await readError(response) };
    return { ok: true, number: (await response.json()).number };
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message !== "Failed to fetch" ? error.message : failed };
  }
}

export async function cancelReturn(returnId: number, send: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await postJson(send, `/api/returns/${returnId}/cancel`, {});
    return response.ok ? { ok: true } : { ok: false, message: await readError(response) };
  } catch {
    return { ok: false, message: "We couldn't cancel this Return. Please try again." };
  }
}
