import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  primaryKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// This small table establishes the initial schema while auth and commerce tables are added in later tickets.
export const appMetadata = pgTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const customers = pgTable("customers", {
  // This is the Neon Auth user id. A foreign key is deliberately not possible:
  // application migrations must never write to or manage the neon_auth schema.
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  // The three names joined, kept because Neon Auth and the profile use it.
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  contactNumber: text("contact_number").notNull(),
  marketingOptIn: boolean("marketing_opt_in").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Set when the Customer deletes their account. The profile is hidden and the
  // login refused; no row or field is ever deleted or nulled.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** One row per Customer whose welcome email was claimed; the primary key is the idempotency key. */
export const welcomeEmails = pgTable("welcome_emails", {
  customerId: text("customer_id").primaryKey(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailVerificationResends = pgTable("email_verification_resends", {
  email: text("email").primaryKey(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
});

export const usedEmailVerificationTokens = pgTable(
  "used_email_verification_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  },
);

export const addresses = pgTable(
  "addresses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    street: text("street").notNull(),
    barangay: text("barangay").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    /** Set when the Address was picked from the PSGC lists; older Addresses have none. */
    region: text("region"),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull(),
    isDefault: boolean("is_default").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("addresses_one_default_per_customer")
      .on(table.customerId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const products = pgTable("products", {
  // Derived from the grouped Product's name, not the source Shopify handle,
  // since several Shopify products (one per weight) become one Product.
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const productImages = pgTable(
  "product_images",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productSlug: text("product_slug")
      .notNull()
      .references(() => products.slug, { onDelete: "cascade" }),
    // Kept during migration so older rows and rollback still have their Blob address.
    url: text("url"),
    /** Public, Permanent File owned by IMS. */
    fileId: text("file_id"),
    alt: text("alt").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [uniqueIndex("product_images_position").on(table.productSlug, table.position)],
);

export const sizes = pgTable(
  "sizes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productSlug: text("product_slug")
      .notNull()
      .references(() => products.slug, { onDelete: "cascade" }),
    label: text("label").notNull(),
    // Philippine pesos in centavos, so prices never pass through floating point.
    priceInCentavos: integer("price_in_centavos").notNull(),
    available: boolean("available").notNull(),
    /** The IMS FinishedProducts.ProductId this Size mirrors; null for a Size the IMS has not yet been matched to. */
    imsProductId: integer("ims_product_id"),
    /** Removed or deactivated in the IMS: leaves the shop and cannot be ordered, while open Orders keep their Reservations. */
    discontinued: boolean("discontinued").notNull().default(false),
  },
  (table) => [
    uniqueIndex("sizes_product_label").on(table.productSlug, table.label),
    uniqueIndex("sizes_ims_product_id").on(table.imsProductId),
  ],
);

/** A price the IMS wants to apply to a Size that was already on sale; the owner checks it before it goes live. */
export const imsPriceChanges = pgTable("ims_price_changes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sizeId: integer("size_id").notNull().references(() => sizes.id, { onDelete: "cascade" }),
  oldPriceInCentavos: integer("old_price_in_centavos").notNull(),
  newPriceInCentavos: integer("new_price_in_centavos").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ims_price_changes_one_pending").on(table.sizeId).where(sql`${table.status} = 'pending'`),
  check("ims_price_changes_status", sql`${table.status} in ('pending', 'approved')`),
]);
/** A Customer has at most one line for each Size in their persisted Cart. */
export const cartLines = pgTable(
  "cart_lines",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    sizeId: integer("size_id")
      .notNull()
      .references(() => sizes.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [uniqueIndex("cart_lines_customer_size").on(table.customerId, table.sizeId)],
);

/** Records a completed Visitor Cart merge, so retried requests stay idempotent. */
export const cartMerges = pgTable("cart_merges", {
  visitorCartId: text("visitor_cart_id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A Customer's Senior Citizen or PWD ID check. The ID number is never stored: only `idHash`, an HMAC of it under
 * a server secret, so the same number cannot verify a second account. The photo is deleted right after review.
 */
export const seniorPwdVerifications = pgTable("senior_pwd_verifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  idType: text("id_type").notNull(),
  status: text("status").notNull().default("pending"),
  idHash: text("id_hash").notNull(),
  /** Private File id of the ID photo (front); cleared once reviewed or after 7 days. */
  photoFileId: text("photo_file_id"),
  /** Private File id of the back of the ID, when the number is there. */
  photoBackFileId: text("photo_back_file_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  /** Opaque br-auth-service Staff id and name snapshot; never a foreign key. */
  decidedById: text("decided_by_id"),
  decidedByName: text("decided_by_name"),
  declineReason: text("decline_reason"),
  /** The ID's expiry date; the discount stops on it. */
  expiresOn: date("expires_on"),
  /**
   * The other account's verification that carries the same ID number, when there is one. A number in use (pending or
   * approved) is refused outright, so this is set only for a number last seen declined, revoked or expired, or if a
   * clash ever got past the check. CREOMS cannot read `idHash`, so this is how Staff learn the number was used before.
   */
  sameIdAsVerificationId: integer("same_id_as_verification_id"),
}, (table) => [
  index("senior_pwd_verifications_customer").on(table.customerId),
  index("senior_pwd_verifications_hash").on(table.idHash),
]);

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  /** The approved ID check this Order's discount comes from. */
  seniorPwdVerificationId: integer("senior_pwd_verification_id").references(() => seniorPwdVerifications.id, { onDelete: "restrict" }),
  /** The CREOMS rule's discount on one unit of the Order's priciest item, in centavos; counts only while the verification is approved. */
  seniorPwdDiscountInCentavos: integer("senior_pwd_discount_in_centavos"),
  /** The most one ID could get per period under the rule this Order was placed with; null on Orders placed before the rule was configurable (₱125 per week). */
  seniorPwdLimitInCentavos: integer("senior_pwd_limit_in_centavos"),
  seniorPwdLimitPer: text("senior_pwd_limit_per"),
  fulfillmentMethod: text("fulfillment_method").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull(),
  subtotalInCentavos: integer("subtotal_in_centavos").notNull(),
  // Pickup Orders never have a Delivery fee; delivery fees are added by CREOMS.
  deliveryFeeInCentavos: integer("delivery_fee_in_centavos"),
  deliveryFeeQuoteRequired: boolean("delivery_fee_quote_required").default(false).notNull(),
  /** Free delivery judged once for a Delivery Order (#579), with the threshold in force; both stay as saved. Null threshold = not judged yet. */
  freeDelivery: boolean("free_delivery").default(false).notNull(),
  freeDeliveryThresholdInCentavos: integer("free_delivery_threshold_in_centavos"),
  /** The final amounts Staff confirmed, saved once at confirmation and never recalculated. Empty on Orders not yet confirmed by Staff. */
  approvedDiscountInCentavos: integer("approved_discount_in_centavos"),
  totalInCentavos: integer("total_in_centavos"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /** Why the Order was cancelled before preparing: the Customer's reason, or the reason Staff gave when they rejected it. Null otherwise. */
  cancelReason: text("cancel_reason"),
  /** When an unpaid Online payment Order is cancelled; saved with `confirmedAt` in the same write and never moved by email delay, failure, retry or Resend. Null on Orders confirmed before this existed (24 hours after `confirmedAt`). */
  paymentDeadlineAt: timestamp("payment_deadline_at", { withTimezone: true }),
  /** How much of the ID's limit for the period other Orders had used when this one was confirmed, in centavos. */
  seniorPwdAllowanceUsedInCentavos: integer("senior_pwd_allowance_used_in_centavos"),
  /** Why the Senior/PWD discount was reduced at confirmation; null when it was not. */
  seniorPwdReductionReason: text("senior_pwd_reduction_reason"),
  // GCash Payment proof: a reference number and optional screenshot the Customer
  // submits once the Order is confirmed. This app stores it but never verifies
  // it or marks the Order paid itself — that happens via the internal API.
  gcashReferenceNumber: text("gcash_reference_number"),
  /** Legacy Vercel Blob pathname; new proofs use `paymentProofFileId`. */
  paymentProofScreenshotPathname: text("payment_proof_screenshot_pathname"),
  /** Private file-storage File id of the screenshot. */
  paymentProofFileId: text("payment_proof_file_id"),
  paymentProofSubmittedAt: timestamp("payment_proof_submitted_at", { withTimezone: true }),
  /** Null while the latest proof waits for a check or after a new one arrives. */
  paymentProofRejectedAt: timestamp("payment_proof_rejected_at", { withTimezone: true }),
  /** Proofs rejected so far; at 3 only a Manager can approve. */
  paymentProofRejections: integer("payment_proof_rejections").default(0).notNull(),
  /** Opaque br-auth-service Staff id and display-name snapshot; never a foreign key. */
  packingStartedAt: timestamp("packing_started_at", { withTimezone: true }),
  packedById: text("packed_by_id"),
  packedByName: text("packed_by_name"),
  packedAt: timestamp("packed_at", { withTimezone: true }),
  paidById: text("paid_by_id"),
  paidByName: text("paid_by_name"),
  // Legacy paid Orders keep all three attribution fields empty.
  paidAt: timestamp("paid_at", { withTimezone: true }),
  // COD collection (epic-crms#601): the cash recorded when a Cash on Delivery Order is completed. Empty for every other Order.
  codCollectedAmountInCentavos: integer("cod_collected_amount_in_centavos"),
  codCollectedAt: timestamp("cod_collected_at", { withTimezone: true }),
  codCollectedById: text("cod_collected_by_id"),
  codCollectedByName: text("cod_collected_by_name"),
  // When the Order became Delivered. Orders delivered before this column existed keep it empty.
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  /** When a Pickup Order became Picked up (`collected`); it stands in for `deliveredAt` for every rule. */
  collectedAt: timestamp("collected_at", { withTimezone: true }),
  /** Private File id of proof of delivery; empty before delivery, for legacy Orders, or after removal. */
  deliveryPhotoFileId: text("delivery_photo_file_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  deliveryPhotoRemovedAt: timestamp("delivery_photo_removed_at", { withTimezone: true }),
  /** Courier booking recorded at dispatch; kept after the tracking link expires. Rider details are optional. */
  /** A Manager may extend the 24-hour Refund window once by 24 hours; when, who and why. */
  refundWindowExtendedAt: timestamp("refund_window_extended_at", { withTimezone: true }),
  refundWindowExtensionReason: text("refund_window_extension_reason"),
  refundWindowExtendedById: text("refund_window_extended_by_id"),
  refundWindowExtendedByName: text("refund_window_extended_by_name"),
  /** Set only on a Replacement Order: the Order and Return it replaces. It never counts as a sale. */
  replacementForOrderId: integer("replacement_for_order_id"),
  replacementForReturnId: integer("replacement_for_return_id"),
  courier: text("courier"),
  courierTrackingUrl: text("courier_tracking_url"),
  riderName: text("rider_name"),
  riderPlate: text("rider_plate"),
  riderPhone: text("rider_phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  // One Replacement Order per Return; NULLs (every ordinary Order) never collide.
  uniqueIndex("orders_replacement_for_return").on(table.replacementForReturnId),
]);

/** Every payment proof a Customer submitted, kept for good with its rejection. The columns on `orders` mirror the latest. */
export const orderPaymentProofs = pgTable("order_payment_proofs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  reference: text("reference"),
  confirmedAmountInCentavos: integer("confirmed_amount_in_centavos"),
  confirmedPaidAt: timestamp("confirmed_paid_at", { withTimezone: true }),
  confirmedRecipient: text("confirmed_recipient"),
  expectedRecipient: text("expected_recipient"),
  /** The Payment account the Customer says they paid, copied whole so a later edit or deactivation never changes it. */
  accountId: text("account_id"),
  accountMethod: text("account_method"),
  accountBankName: text("account_bank_name"),
  accountLabel: text("account_label"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  /** One per form load, so a retried submit never saves a second proof. */
  submissionKey: text("submission_key"),
  screenshotFileId: text("screenshot_file_id"),
  screenshotPathname: text("screenshot_pathname"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedById: text("rejected_by_id"),
  rejectedByName: text("rejected_by_name"),
  rejectionReason: text("rejection_reason"),
}, (table) => [
  index("order_payment_proofs_order").on(table.orderId),
  uniqueIndex("order_payment_proofs_submission_key").on(table.orderId, table.submissionKey),
]);

/**
 * An Order whose Customer was locked out after the third rejected proof. One per Order; CREOMS reads it through its
 * SELECT-only role and a Manager decides. `resolvedAt` stays null until a Manager approves the payment or the Order ends.
 */
export const managerReviews = pgTable("manager_reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  /** Why the third proof was turned down. */
  reason: text("reason").notNull(),
  rejections: integer("rejections").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("manager_reviews_order").on(table.orderId),
]);

/** Immutable line-item copies, retained even if the catalog changes later. */
export const orderLines = pgTable("order_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label").notNull(),
  priceInCentavos: integer("price_in_centavos").notNull(),
  quantity: integer("quantity").notNull(),
});

/** Immutable snapshots of items removed by a partial cancellation. */
export const orderCancelledItems = pgTable("order_cancelled_items", {
  orderId: integer("order_id").notNull().references(() => orders.id),
  orderLineId: integer("order_line_id").primaryKey(),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label").notNull(),
  priceInCentavos: integer("price_in_centavos").notNull(),
  quantity: integer("quantity").notNull(),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Immutable delivery destination copied from the Customer's chosen Address. */
export const orderDeliveryAddresses = pgTable("order_delivery_addresses", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  street: text("street").notNull(),
  barangay: text("barangay").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  /** Set when the Address was picked from the PSGC lists; older Orders have none and show as plain text. */
  region: text("region"),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
});

/** A Customer's one-time, private response to a delivered Order. */
export const orderFeedback = pgTable("order_feedback", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** Set by CREOMS's scheduled analysis; empty until the Feedback has been analyzed. */
  sentiment: text("sentiment", { enum: ["positive", "neutral", "negative"] }),
  /** The model that produced the Sentiment. */
  sentimentModel: text("sentiment_model"),
  sentimentAnalyzedAt: timestamp("sentiment_analyzed_at", { withTimezone: true }),
});

/** One run of CREOMS's Feedback analysis; backs "Last analyzed" and the failure warning. Written only by CREOMS. */
export const feedbackAnalysisRuns = pgTable("feedback_analysis_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** "schedule" or "staff". */
  startedByKind: text("started_by_kind").notNull(),
  startedById: text("started_by_id"),
  startedByName: text("started_by_name"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  /** Empty while the run is in progress. */
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  analyzed: integer("analyzed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  model: text("model"),
});

/** The one Feedback request sent for an Order; its absence means the Customer has not been asked yet. */
export const feedbackRequests = pgTable("feedback_requests", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  sentAt: timestamp("sent_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** A Customer-owned Support request, optionally about one of their Orders. */
export const tickets = pgTable("tickets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  category: text("category").notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "restrict" }),
  /** `open`, `on_hold` (staff wait on someone else), `resolved` (staff say it is answered) or `completed` (done). */
  status: text("status").notNull().default("open"),
  /** `low`, `normal`, `high` or `urgent`; set by staff in CREOMS. */
  priority: text("priority").notNull().default("normal"),
  /** The staff member working the Ticket: an opaque id from br-auth-service, never a foreign key. */
  claimedById: text("claimed_by_id"),
  /** The Claimer's display name as it was when they claimed the Ticket. */
  claimedByName: text("claimed_by_name"),
  /** Why the Ticket is On hold: `courier`, `kitchen_or_ims`, `supplier` or `manager_decision`. Never shown to the Customer. */
  holdReason: text("hold_reason"),
  /** The Claimer's Staff-only note on the hold. Never shown to the Customer. */
  holdNote: text("hold_note"),
  /** When the Ticket returns to Open by itself. */
  holdUntil: timestamp("hold_until", { withTimezone: true }),
  /** When the current hold began; set and cleared by a database trigger on every status change, so every writer is counted. */
  holdStartedAt: timestamp("hold_started_at", { withTimezone: true }),
  /** Seconds the Ticket has spent On hold in finished holds; the Service level clock stops for them. Kept by the same trigger. */
  heldSeconds: integer("held_seconds").notNull().default(0),
  /** The Completed Ticket this one follows up; null for an ordinary Ticket. The old Ticket stays Completed. */
  followUpOfId: integer("follow_up_of_id").references((): AnyPgColumn => tickets.id, { onDelete: "restrict" }),
  /** The Customer's optional 1 to 5 stars, given once when they confirm a fix or complete the Ticket; never edited. Staff-only. */
  rating: integer("rating"),
  /** The Customer's optional comment with the rating. Staff-only. */
  ratingComment: text("rating_comment"),
  ratedAt: timestamp("rated_at", { withTimezone: true }),
  /** When staff last marked the Ticket Resolved. */
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** An immutable entry in a Ticket's Customer-and-staff message thread. */
export const ticketMessages = pgTable("ticket_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  /** Blob pathname of the optional image, never a public URL. */
  attachmentPathname: text("attachment_pathname"),
  /** Id of the optional file in file storage, set by CREOMS. */
  fileId: text("file_id"),
  /** An Internal note: Staff-only, never returned to the Customer, never a Staff reply. */
  internal: boolean("internal").default(false).notNull(),
  /** Who wrote an Internal note; null on every other Message. */
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** One row per IP address, holding its most recent submission times so the window truly rolls. */
export const feedbackRateLimits = pgTable("feedback_rate_limits", {
  ipAddress: text("ip_address").primaryKey(),
  submissionTimes: timestamp("submission_times", { withTimezone: true }).array().notNull(),
});

export const returnStatuses = ["requested", "approved", "goods received", "refunded", "replaced", "declined", "cancelled"] as const;
export const returnResolutions = ["refund", "replacement"] as const;

/** A Customer's whole-item Return request; Staff decisions never change the Order's status. */
export const orderReturns = pgTable("order_returns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  status: text("status", { enum: returnStatuses })
    .notNull().default("requested"),
  reason: text("reason", { enum: ["damaged", "defective", "wrong item", "other"] }).notNull(),
  note: text("note").notNull().default(""),
  amountInCentavos: integer("amount_in_centavos").notNull(),
  preferredResolution: text("preferred_resolution", { enum: returnResolutions }).notNull().default("refund"),
  finalResolution: text("final_resolution", { enum: returnResolutions }),
  videoFileId: text("video_file_id"),
  refundProofFileId: text("refund_proof_file_id"),
  /** The Delivery fee a Manager included in the refund (epic-crms#611); null when only the items were refunded. Never counts toward the Approval limit. */
  refundDeliveryFeeInCentavos: integer("refund_delivery_fee_in_centavos"),
  refundDeliveryFeeReason: text("refund_delivery_fee_reason"),
  /** What Staff recorded when marking the Return Refunded (epic-crms#613): the amount sent, how, on what date and under what reference. Null before that. */
  refundAmountInCentavos: integer("refund_amount_in_centavos"),
  refundPaidMethod: text("refund_paid_method", { enum: ["gcash", "maya", "bank-transfer"] }),
  refundPaidOn: date("refund_paid_on", { mode: "string" }),
  refundReference: text("refund_reference"),
  /** Where the refund goes, confirmed by the Customer on the request; never a payment proof's recipient. Null for a replacement. */
  refundMethod: text("refund_method", { enum: ["gcash", "maya", "bank-transfer"] }),
  refundAccountName: text("refund_account_name"),
  refundAccountNumber: text("refund_account_number"),
  refundBankName: text("refund_bank_name"),
  refundDestinationConfirmedAt: timestamp("refund_destination_confirmed_at", { withTimezone: true }),
  /** Null until approval; false allows completing without returning the goods. */
  goodsRequired: boolean("goods_required"),
  declineReason: text("decline_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  replacedAt: timestamp("replaced_at", { withTimezone: true }),
}, (table) => [
  check("order_returns_status", sql`${table.status} in ('requested','approved','goods received','refunded','replaced','declined','cancelled')`),
  check("order_returns_preferred_resolution", sql`${table.preferredResolution} in ('refund','replacement')`),
  check("order_returns_final_resolution", sql`${table.finalResolution} in ('refund','replacement')`),
  check("order_returns_reason", sql`${table.reason} in ('damaged','defective','wrong item','other')`),
  check("order_returns_amount", sql`${table.amountInCentavos} >= 0`),
  check("order_returns_refund_delivery_fee", sql`${table.refundDeliveryFeeInCentavos} >= 0`),
  check("order_returns_refund_amount", sql`${table.refundAmountInCentavos} >= 0`),
  check("order_returns_refund_paid_method", sql`${table.refundPaidMethod} in ('gcash','maya','bank-transfer')`),
  check("order_returns_refund_method", sql`${table.refundMethod} in ('gcash','maya','bank-transfer')`),
  index("order_returns_order_id").on(table.orderId),
]);

/** The refund details a Customer last confirmed, offered as the pre-fill on their next Return. One row per Customer. */
export const customerRefundDestinations = pgTable("customer_refund_destinations", {
  customerId: text("customer_id").primaryKey().references(() => customers.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["gcash", "maya", "bank-transfer"] }).notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  bankName: text("bank_name"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
}, (table) => [
  check("customer_refund_destinations_method", sql`${table.method} in ('gcash','maya','bank-transfer')`),
]);

/** Immutable snapshots of the whole Order lines selected by the Customer. */
export const orderReturnItems = pgTable("order_return_items", {
  returnId: integer("return_id").notNull().references(() => orderReturns.id, { onDelete: "cascade" }),
  orderLineId: integer("order_line_id").notNull().references(() => orderLines.id, { onDelete: "restrict" }),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label").notNull(),
  quantity: integer("quantity").notNull(),
  priceInCentavos: integer("price_in_centavos").notNull(),
}, (table) => [
  primaryKey({ columns: [table.returnId, table.orderLineId] }),
  check("order_return_items_quantity", sql`${table.quantity} > 0`),
  check("order_return_items_price", sql`${table.priceInCentavos} >= 0`),
]);

/** Ordered references to private, permanent defect images in file storage. */
export const orderReturnImages = pgTable("order_return_images", {
  returnId: integer("return_id").notNull().references(() => orderReturns.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  fileId: text("file_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.returnId, table.position] }),
  check("order_return_images_position", sql`${table.position} between 1 and 3`),
]);

/** Each decision records the Portal username/Customer id, display-name snapshot and storefront time. */
export const orderReturnHistory = pgTable("order_return_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  returnId: integer("return_id").notNull().references(() => orderReturns.id, { onDelete: "cascade" }),
  status: text("status", { enum: returnStatuses }).notNull(),
  actorType: text("actor_type", { enum: ["customer", "staff"] }).notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  note: text("note"),
}, (table) => [
  check("order_return_history_status", sql`${table.status} in ('requested','approved','goods received','refunded','replaced','declined','cancelled')`),
  check("order_return_history_actor_type", sql`${table.actorType} in ('customer','staff')`),
]);

/** Durable Customer Notifications: saved with the Order change, retained until the service accepts them. */
export const customerNotifications = pgTable("customer_notifications", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

/** Durable checkout intent. These are Order line snapshots, never IMS stock balances. */
export const stockReservations = pgTable("stock_reservations", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  orderId: integer("order_id").references(() => orders.id),
  state: text("state", { enum: ["pending", "placed", "releasing", "released"] }).notNull(),
  lines: jsonb("lines").$type<{
    lineId: string; productId: number; quantity: number; sizeId: number;
    cartLineId: number; priceInCentavos: number; orderLineId?: number; release?: boolean; released?: boolean; deducted?: boolean;
    releaseActor?: import("../audit/gateway").AuditIdentity;
  }[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("stock_reservations_work").on(table.state, table.createdAt), uniqueIndex("stock_reservations_order").on(table.orderId)]);

/** Stable gateway keys make ambiguous email/audit acknowledgements safe to retry. */
export const stockOutbox = pgTable("stock_outbox", {
  key: text("key").primaryKey(),
  kind: text("kind", { enum: ["audit", "email"] }).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  payload: jsonb("payload").$type<import("../audit/gateway").AuditEvent | import("../notifications/gateway").AppEmail>().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
});

/** Staff-owned failed attempts, preserved for COD checks even after rebooking. */
export const failedDeliveries = pgTable("failed_deliveries", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  reason: text("reason").notNull(),
  nextStep: text("next_step").notNull(),
  customerMessage: text("customer_message").notNull(),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  disposition: text("disposition"),
  disposedAt: timestamp("disposed_at", { withTimezone: true }),
  rebookedAt: timestamp("rebooked_at", { withTimezone: true }),
  courier: jsonb("courier").$type<import("../validators/courier").CourierBooking>(),
}, table => [index("failed_deliveries_order").on(table.orderId), check("failed_deliveries_disposition_check", sql`${table.disposition} in ('restock', 'write-off')`)]);

/** A request never changes an Order; CREOMS owns the named Manager/CEO approval chain. */
export const orderCancellations = pgTable("order_cancellations", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  reason: text("reason").notNull(),
  actorType: text("actor_type").notNull(), actorId: text("actor_id").notNull(), actorName: text("actor_name").notNull(),
  status: text("status").notNull().default("waiting-manager"),
  stockOutcome: text("stock_outcome"), refundMethod: text("refund_method"), refundProofFileId: text("refund_proof_file_id"),
  approvalStatus: text("approval_status").notNull().default("waiting-manager"), declineReason: text("decline_reason"),
  settledById: text("settled_by_id"), settledByName: text("settled_by_name"), settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("order_cancellations_order").on(table.orderId),
  check("order_cancellations_status", sql`${table.status} in ('waiting-manager', 'settling', 'cancelled')`),
  check("order_cancellations_stock", sql`${table.stockOutcome} in ('restock','write-off')`)]);

/** A Customer's request to cancel an Order before payment or preparation. A person decides; the Order is frozen while it waits. */
export const orderCancelRequests = pgTable("order_cancel_requests", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("waiting"),
  requestedById: text("requested_by_id").notNull(), requestedByName: text("requested_by_name").notNull(),
  decidedById: text("decided_by_id"), decidedByName: text("decided_by_name"), declineReason: text("decline_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("order_cancel_requests_open").on(table.orderId).where(sql`${table.status} = 'waiting'`),
  index("order_cancel_requests_order").on(table.orderId),
  check("order_cancel_requests_status", sql`${table.status} in ('waiting', 'approved', 'declined', 'withdrawn')`),
]);

/** One Order assistant conversation of a Customer. A chat attached to a Ticket follows the Ticket; others are deleted after the retention. */
export const assistantChats = pgTable("assistant_chats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  /** Set when the Customer sent the chat to the team; the chat is then kept with that Ticket. */
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("assistant_chats_customer").on(table.customerId), index("assistant_chats_created").on(table.createdAt)]);

/** One turn of an Order assistant chat, stored with the Orders looked up and the exact text sent to the model. */
export const assistantMessages = pgTable("assistant_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chatId: integer("chat_id").notNull().references(() => assistantChats.id, { onDelete: "cascade" }),
  /** `customer` or `assistant`. */
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  /** `answered`, `handoff` or `fallback` on an assistant turn; null on the Customer's. */
  outcome: text("outcome"),
  /** Why the turn handed off or fell back, e.g. `refund` or `fact_check_failed`. */
  reason: text("reason"),
  /** The Customer's own Order this turn looked up; null when none was. */
  orderId: integer("order_id"),
  /** Exactly what was sent to the model; null when no model was called. */
  sentToModel: text("sent_to_model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("assistant_messages_chat").on(table.chatId), index("assistant_messages_created").on(table.createdAt)]);

/**
 * The Handoff summary of an Order assistant chat: written from the chat and the Order record, shown to the Customer, and only
 * turned into a Ticket when they press "Send to our team". Kept here, never on the Ticket, apart from the Staff-facing Ticket summary.
 */
export const assistantHandoffs = pgTable("assistant_handoffs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chatId: integer("chat_id").notNull().references(() => assistantChats.id, { onDelete: "cascade" }),
  /** The Customer's own Order the chat was about; becomes the Ticket's Linked order. */
  orderId: integer("order_id"),
  /** Why the chat was handed off, e.g. `refund`, `person_requested` or `fact_check_failed`. */
  reason: text("reason").notNull(),
  /** `drafted` (shown, waiting for the Customer), `dropped` (no summary could be trusted; the Customer writes their own) or `sent`. */
  status: text("status").notNull(),
  /** The summary written for the Customer; null when it was dropped. */
  summary: text("summary"),
  /** The text the Customer approved or wrote themselves; set when sent. */
  sentSummary: text("sent_summary"),
  /** `assistant` or `customer`: whose words the sent summary is. */
  sentSource: text("sent_source"),
  /** Exactly what was sent to the model; null when no model was called. */
  sentToModel: text("sent_to_model"),
  /** The last chat message the summary covers; a newer message makes a new summary. */
  throughMessageId: integer("through_message_id").notNull(),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [uniqueIndex("assistant_handoffs_chat").on(table.chatId),
  check("assistant_handoffs_status", sql`${table.status} in ('drafted','dropped','sent')`)]);

/**
 * One row per Order, kind and occurrence of Customer email. The primary key is the idempotency key: the first insert claims the
 * send, so a repeated confirmation never emails twice. `status` records whether it went out, is waiting for a retry, or failed for good (with the reason).
 */
export const orderEmailOutcomes = pgTable("order_email_outcomes", {
  orderId: integer("order_id").notNull().references(() => orders.id),
  kind: text("kind").notNull(),
  /** Which occurrence of the event this email is for (for example the rejection number); "" when the event happens once. */
  occurrence: text("occurrence").default("").notNull(),
  status: text("status", { enum: ["sending", "sent", "retrying", "failed"] }).notNull(),
  /** The provider's id for the message once it accepted it. A Resend of an email that has one reconciles instead of sending. */
  messageId: text("message_id"),
  reason: text("reason"),
  /** Sends tried so far, the first one included. */
  attempts: integer("attempts").default(0).notNull(),
  /** When the retry job may try again; set only while `status` is "retrying". */
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.orderId, table.kind, table.occurrence] })]);
