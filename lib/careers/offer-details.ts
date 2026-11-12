import { z } from "zod";

import { manilaToday } from "./application-offer";
import { optionalNameField, optionalPhoneField, optionalTextField, personNameCharacterPattern, personNameCharacterPatternMessage } from "../validators/fields";

/** What an Applicant tells HR before their first day. Every answer is optional; "" means not answered. */
export type OfferDetails = {
  birthday: string;
  sex: string;
  civilStatus: string;
  sss: string;
  philhealth: string;
  pagibigMid: string;
  tin: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyMobile: string;
};

export const offerDetailFields = ["birthday", "sex", "civilStatus", "sss", "philhealth", "pagibigMid", "tin", "emergencyName", "emergencyRelationship", "emergencyMobile"] as const satisfies readonly (keyof OfferDetails)[];
export const emptyOfferDetails: OfferDetails = Object.fromEntries(offerDetailFields.map((field) => [field, ""])) as OfferDetails;

export const sexOptions = ["Female", "Male"] as const;
export const civilStatusOptions = ["Single", "Married", "Widowed", "Separated", "Annulled"] as const;

const words = { max: 50, pattern: /^[\p{L}\p{M}\s'.-]+$/u, patternMessage: "Can only contain letters" };

/** An ID number is digits that may be separated by spaces or dashes; `lengths` are the digit counts it can have. */
function idField(label: string, lengths: number[]) {
  const message = `Enter a valid ${label} (${lengths.join(" or ")} digits)`;
  return optionalTextField({ max: 30, pattern: /^[0-9][0-9 -]*$/, patternMessage: message }).refine(
    (value) => value === "" || lengths.includes(value.replace(/\D/g, "").length),
    message,
  );
}

const birthdayField = z
  .string()
  .max(10, "Enter a valid birthday")
  .nullish()
  .transform((value) => (value ?? "").trim())
  .pipe(
    z
      .string()
      .refine((value) => value === "" || (/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value), "Enter a valid birthday")
      .refine((value) => value <= manilaToday(), "Your birthday can't be in the future"),
  );

const mobileField = optionalPhoneField({ pattern: /^(\+?63|0)9\d{9}$/, patternMessage: "Enter a Philippine mobile number, like 0917 123 4567" });

const schema = z.object({
  birthday: birthdayField,
  sex: optionalTextField({ ...words, max: 20 }),
  civilStatus: optionalTextField({ ...words, max: 20 }),
  sss: idField("SSS number", [10]),
  philhealth: idField("PhilHealth number", [12]),
  pagibigMid: idField("Pag-IBIG MID", [12]),
  tin: idField("TIN", [9, 12]),
  emergencyName: optionalNameField({ max: 100, pattern: personNameCharacterPattern, patternMessage: personNameCharacterPatternMessage }),
  emergencyRelationship: optionalTextField(words),
  emergencyMobile: mobileField,
});

export type OfferDetailsResult = { ok: true; details: OfferDetails } | { ok: false; errors: Partial<Record<keyof OfferDetails, string>> };

/** Cleans and checks what the form sent. Nothing is required, but anything given must be well formed. */
export function validateOfferDetails(input: Record<string, unknown>): OfferDetailsResult {
  const parsed = schema.safeParse(Object.fromEntries(offerDetailFields.map((field) => [field, typeof input[field] === "string" ? input[field] : ""])));
  if (parsed.success) return { ok: true, details: parsed.data };
  const errors: Partial<Record<keyof OfferDetails, string>> = {};
  for (const issue of parsed.error.issues) errors[issue.path[0] as keyof OfferDetails] ??= issue.message;
  return { ok: false, errors };
}

/** HRMS holds the answers (ADR-0002); Careers reads and replaces them only through this gateway. */
export type OfferDetailsGateway = {
  read(input: { offerId: number; applicantId: string }): Promise<OfferDetails>;
  save(input: { offerId: number; applicantId: string; details: OfferDetails }): Promise<void>;
};

/** HRMS refused the save and said why in words an Applicant can read (hired, withdrawn, declined). */
export class OfferDetailsRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OfferDetailsRefusal";
  }
}

const REQUEST_TIMEOUT_MS = 8_000;

type HrmsDetails = {
  birthday: string | null; sex: string | null; civilStatus: string | null;
  governmentIds: { sss: string | null; philhealth: string | null; pagibigMid: string | null; tin: string | null };
  emergencyContact: { name: string | null; relationship: string | null; mobile: string | null };
};

const toHrms = (d: OfferDetails) => ({
  birthday: d.birthday, sex: d.sex, civilStatus: d.civilStatus,
  governmentIds: { sss: d.sss, philhealth: d.philhealth, pagibigMid: d.pagibigMid, tin: d.tin },
  emergencyContact: { name: d.emergencyName, relationship: d.emergencyRelationship, mobile: d.emergencyMobile },
});

const fromHrms = (d: HrmsDetails): OfferDetails => ({
  birthday: d.birthday ?? "", sex: d.sex ?? "", civilStatus: d.civilStatus ?? "",
  sss: d.governmentIds?.sss ?? "", philhealth: d.governmentIds?.philhealth ?? "", pagibigMid: d.governmentIds?.pagibigMid ?? "", tin: d.governmentIds?.tin ?? "",
  emergencyName: d.emergencyContact?.name ?? "", emergencyRelationship: d.emergencyContact?.relationship ?? "", emergencyMobile: d.emergencyContact?.mobile ?? "",
});

/**
 * The real gateway: `POST` replaces the answers and `GET ?applicantId=` reads them, both at `{HRMS_URL}/api/careers/offers/{id}/details`
 * with the Careers caller key as a bearer token. The Applicant id is the one Careers signed in. Errors never carry the answers.
 */
export function createHrmsOfferDetailsGateway(options: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}): OfferDetailsGateway {
  const env = options.env ?? process.env;
  const send = options.fetch ?? fetch;
  function target(offerId: number, query = "") {
    const base = env.HRMS_URL?.trim();
    const key = env.CAREERS_CALLER_KEY?.trim();
    if (!base || !key) throw new Error("HRMS is not configured for offer details");
    return { url: `${base.replace(/\/$/, "")}/api/careers/offers/${encodeURIComponent(String(offerId))}/details${query}`, key };
  }
  return {
    async read({ offerId, applicantId }) {
      const { url, key } = target(offerId, `?applicantId=${encodeURIComponent(applicantId)}`);
      const response = await send(url, { headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HRMS answered ${response.status}`);
      const body = (await response.json()) as { details?: HrmsDetails };
      if (!body.details) throw new Error("HRMS sent no details");
      return fromHrms(body.details);
    },
    async save({ offerId, applicantId, details }) {
      const { url, key } = target(offerId);
      const response = await send(url, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ applicantId, ...toHrms(details) }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return;
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      if ([404, 409].includes(response.status) && typeof body?.message === "string") throw new OfferDetailsRefusal(body.message, response.status);
      throw new Error(`HRMS answered ${response.status}`);
    },
  };
}

export type SaveDetailsOutcome = { ok: true } | { ok: false; message: string; errors?: Partial<Record<keyof OfferDetails, string>> };

/** Validates, then replaces the answers through the gateway. A refusal shows HRMS's own words, a failure a retry. */
export async function saveOfferDetails(
  input: { applicantId: string; offerId: number; values: Record<string, unknown> },
  deps: { gateway: OfferDetailsGateway },
): Promise<SaveDetailsOutcome> {
  const checked = validateOfferDetails(input.values);
  if (!checked.ok) return { ok: false, message: "Check the highlighted answers and try again.", errors: checked.errors };
  try {
    await deps.gateway.save({ offerId: input.offerId, applicantId: input.applicantId, details: checked.details });
    return { ok: true };
  } catch (error) {
    if (error instanceof OfferDetailsRefusal) return { ok: false, message: error.message };
    console.error("Offer details could not be saved", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: "We couldn't save your details. Try again." };
  }
}
