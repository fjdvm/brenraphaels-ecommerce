import { createHmac, timingSafeEqual } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { fileIdField } from "../validators/file-id";
import { textField } from "../validators/fields";
import { evidenceLimits, evidenceRoles, evidenceTypes, evidenceUploadInput, ReturnRequestError, type EvidenceRole } from "./return-input";

export type EvidenceOwner = { customerId: string; orderId: number };
export type ReturnEvidenceFiles = {
  prepare(owner: EvidenceOwner, input: z.output<typeof evidenceUploadInput>): Promise<{ id: string; uploadUrl: string; uploadToken: string }>;
  /** Verifies a staging upload and seals its bytes in a new Private, Permanent File. */
  read(owner: EvidenceOwner, role: EvidenceRole, uploadToken: string): Promise<{ id: string; bytes: Uint8Array }>;
};

const binding = z.object({
  id: fileIdField,
  customerId: textField("Customer id", { min: 1, max: 256, pattern: /^[^\s<>]+$/u, patternMessage: "Invalid Customer", rejectInvisible: true }),
  orderId: z.number().int().positive(), role: z.enum(evidenceRoles), expires: z.number().int(),
}).strict();
const invalid = () => new ReturnRequestError("Choose evidence uploaded for this Customer and Order.", 400);

/** Checks stored bytes, never a browser MIME or filename. */
export async function validateReturnEvidence(bytes: Uint8Array, role: EvidenceRole) {
  if (bytes.length === 0 || bytes.length > evidenceLimits[role]) {
    throw new ReturnRequestError(role === "photo" ? "Photos must be nonempty and 5 MB or smaller." : "Videos must be nonempty and 25 MB or smaller.", 400);
  }
  let detected;
  try { detected = await fileTypeFromBuffer(bytes); } catch { /* Truncated files are invalid evidence. */ }
  if (!detected || !evidenceTypes[role].includes(detected.mime)) {
    throw new ReturnRequestError(role === "photo" ? "Attach a real JPG or PNG photo." : "Attach a real MP4 or MOV video.", 400);
  }
  return detected;
}

/** Direct browser uploads avoid routing up to 40 MB through a storefront Function. */
export function gatewayReturnEvidence({ baseUrl = process.env.API_GATEWAY_URL, callerKey = process.env.API_GATEWAY_CALLER_KEY,
  fetch: send = fetch, now = () => Date.now() }: { baseUrl?: string; callerKey?: string; fetch?: typeof fetch; now?: () => number } = {}): ReturnEvidenceFiles {
  function sign(payload: string) {
    if (!callerKey) throw new Error("API_GATEWAY_CALLER_KEY must be set.");
    return createHmac("sha256", callerKey).update(`return-evidence:${payload}`).digest();
  }
  async function call(path: string, init: RequestInit = {}) {
    if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_CALLER_KEY must be set.");
    const response = await send(`${baseUrl.replace(/\/$/, "")}/files${path}`, { ...init,
      headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error" });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) throw new ReturnRequestError("Evidence upload was refused or is incomplete. Upload a JPG/PNG photo or MP4/MOV video again.", 400);
      throw new Error(`Return file-storage request failed: ${response.status}`);
    }
    return response.json();
  }
  return {
    async prepare(owner, input) {
      const parsed = evidenceUploadInput.parse(input);
      const extension = { "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "video/quicktime": "mov" }[parsed.contentType];
      const pending = await call("", { method: "POST", body: JSON.stringify({ filename: `return-${parsed.role}.${extension}`,
        contentType: parsed.contentType, size: parsed.size, visibility: "private", retentionType: "temporary" }) });
      const payload = Buffer.from(JSON.stringify(binding.parse({ ...owner, id: pending.id, role: parsed.role,
        expires: now() + 60 * 60 * 1000 }))).toString("base64url");
      return { id: pending.id, uploadUrl: pending.uploadUrl, uploadToken: `${payload}.${sign(payload).toString("base64url")}` };
    },
    async read(owner, role, token) {
      const [payload, signature, extra] = token.split(".");
      if (!payload || !signature || extra !== undefined) throw invalid();
      const expected = sign(payload);
      const actual = Buffer.from(signature, "base64url");
      if (actual.toString("base64url") !== signature || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
      let parsed;
      try { parsed = binding.parse(JSON.parse(Buffer.from(payload, "base64url").toString())); } catch { throw invalid(); }
      if (parsed.customerId !== owner.customerId || parsed.orderId !== owner.orderId || parsed.role !== role || parsed.expires <= now()) throw invalid();
      // Confirmation validates the uploaded object. The browser receives no gateway credential.
      await call(`/${encodeURIComponent(parsed.id)}/confirm`, { method: "POST" });
      const file = await call(`/${encodeURIComponent(parsed.id)}`);
      if (file.id !== parsed.id || file.status !== "active" || file.visibility !== "private" || file.retentionType !== "temporary" ||
        !evidenceTypes[role].includes(file.contentType) || !Number.isInteger(file.size) || file.size <= 0 || file.size > evidenceLimits[role]) throw invalid();
      const response = await send(file.url, { cache: "no-store", redirect: "error" });
      if (!response.ok || !response.body) throw new ReturnRequestError("Evidence could not be read. Upload it again.", 400);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > evidenceLimits[role]) throw invalid();
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      if (length !== file.size) throw invalid();
      const bytes = Buffer.concat(chunks);
      const detected = await validateReturnEvidence(bytes, role);
      if (detected.mime !== file.contentType) throw invalid();
      // A browser can reuse its staging PUT URL until it expires. Seal a different object
      // using a server-only PUT URL so accepted evidence can never be overwritten by it.
      const sealed = await call("", { method: "POST", body: JSON.stringify({ filename: `return-${role}.${detected.ext}`,
        contentType: detected.mime, size: bytes.length, visibility: "private", retentionType: "permanent" }) });
      const sealedId = fileIdField.parse(sealed.id);
      if (sealedId === parsed.id) throw invalid();
      const put = await send(sealed.uploadUrl, { method: "PUT", headers: { "Content-Type": detected.mime }, body: bytes,
        redirect: "error" });
      if (!put.ok) throw new Error(`Sealing Return evidence failed: ${put.status}`);
      const confirmed = await call(`/${encodeURIComponent(sealedId)}/confirm`, { method: "POST" });
      if (confirmed.id !== sealedId || confirmed.status !== "active" || confirmed.visibility !== "private" || confirmed.retentionType !== "permanent" ||
        confirmed.contentType !== detected.mime || confirmed.size !== bytes.length) throw invalid();
      return { id: sealedId, bytes };
    },
  };
}
