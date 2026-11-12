/** The Offer's status as the Applicant may see it. A Draft is never read: the Applicant sees nothing until it is sent. */
export type OfferStatus = "Sent" | "Accepted" | "Declined";

/** An Offer as HRMS holds it, read from the shared database. Dates are calendar dates ("YYYY-MM-DD") except the instants. */
export type ApplicationOffer = {
  id: number;
  status: OfferStatus;
  monthlyPay: number;
  startDate: string;
  employmentType: string;
  schedule: string;
  probation: string;
  reportsTo: string;
  branch: string;
  sentAt: Date | null;
  replyBy: string | null;
  repliedAt: Date | null;
};

export type RequiredDocumentStatus = "Submitted" | "In review" | "To upload";

/** One Document the Applicant must submit at the Offer stage, as HR-ATS reports it. */
export type RequiredDocument = { name: string; hint?: string | null; status: RequiredDocumentStatus };

export const toBeConfirmed = "To be confirmed";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

export function formatMonthlyPay(amount: number | null | undefined) {
  return typeof amount === "number" && Number.isFinite(amount) ? peso.format(amount).replace(/ /g, "") : toBeConfirmed;
}

/** Done means Submitted or In review; the rest still need an upload. */
export function requiredDocumentProgress(documents: RequiredDocument[]) {
  const done = documents.filter((document) => document.status !== "To upload").length;
  return { done, total: documents.length, percent: documents.length ? Math.round((done / documents.length) * 100) : 0 };
}

/** Today in Manila as "YYYY-MM-DD". */
export const manilaToday = (now: Date = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** A Sent Offer past its reply-by date. It is only flagged: nothing expires and a late reply still works. */
export const isOfferOverdue = (offer: Pick<ApplicationOffer, "status" | "replyBy">, today: string) =>
  offer.status === "Sent" && offer.replyBy !== null && offer.replyBy < today;

/** A calendar date from the database as an instant the Manila date formatter reads as the same day. */
export const offerDate = (value: string) => new Date(`${value}T00:00:00Z`);

export type OfferView = "reply" | "accepted" | "declined" | "hired";

/**
 * What the Application page shows for an Offer. Draft (no Offer read) shows nothing, and so does a withdrawn Application.
 * Accepted and Sent keep the document checklist; Declined has none. A declined Offer closes the Application as Rejected in HRMS,
 * so it still shows the Offer, with an "Offer declined" outcome rather than "Not selected".
 */
export function offerPresentation(applicationStatus: string, offer: ApplicationOffer | undefined | null): { view: OfferView | null; showDocuments: boolean; outcomeStatus: string } {
  const outcomeStatus = offer?.status === "Declined" && applicationStatus === "Rejected" ? "Declined" : applicationStatus;
  if (!offer || applicationStatus === "Withdrawn") return { view: null, showDocuments: false, outcomeStatus };
  if (applicationStatus === "Hired") return { view: "hired", showDocuments: false, outcomeStatus };
  if (offer.status === "Declined") return { view: "declined", showDocuments: false, outcomeStatus };
  if (applicationStatus !== "Offer") return { view: null, showDocuments: false, outcomeStatus };
  return { view: offer.status === "Sent" ? "reply" : "accepted", showDocuments: true, outcomeStatus };
}
