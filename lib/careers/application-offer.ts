/** Offer terms HR-ATS may send for an Application at the Offer stage. Every term is optional; a missing one is shown as "To be confirmed", never invented. */
export type ApplicationOffer = {
  monthlyPay?: number | null;
  startDate?: Date | null;
  schedule?: string | null;
  replyBy?: Date | null;
  letterName?: string | null;
};

export type RequiredDocumentStatus = "Submitted" | "In review" | "To upload";

/** One Document the Applicant must submit at the Offer stage, as HR-ATS reports it. */
export type RequiredDocument = { name: string; hint?: string | null; status: RequiredDocumentStatus };

export const toBeConfirmed = "To be confirmed";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

export function formatMonthlyPay(amount: number | null | undefined) {
  return typeof amount === "number" && Number.isFinite(amount) ? peso.format(amount).replace(/ /g, "") : toBeConfirmed;
}

/** Done means Submitted or In review; the rest still need an upload. */
export function requiredDocumentProgress(documents: RequiredDocument[]) {
  const done = documents.filter((document) => document.status !== "To upload").length;
  return { done, total: documents.length, percent: documents.length ? Math.round((done / documents.length) * 100) : 0 };
}
