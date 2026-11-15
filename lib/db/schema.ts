import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
  },
  (table) => [uniqueIndex("sizes_product_label").on(table.productSlug, table.label)],
);
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

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  fulfillmentMethod: text("fulfillment_method").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull(),
  subtotalInCentavos: integer("subtotal_in_centavos").notNull(),
  // Pickup Orders never have a Delivery fee; delivery fees are added by CREOMS.
  deliveryFeeInCentavos: integer("delivery_fee_in_centavos"),
  deliveryFeeQuoteRequired: boolean("delivery_fee_quote_required").default(false).notNull(),
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
  // When the Order became Delivered. Orders delivered before this column existed keep it empty.
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  /** Private File id of proof of delivery; empty before delivery, for legacy Orders, or after removal. */
  deliveryPhotoFileId: text("delivery_photo_file_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  deliveryPhotoRemovedAt: timestamp("delivery_photo_removed_at", { withTimezone: true }),
  /** Courier booking recorded at dispatch; kept after the tracking link expires. Rider details are optional. */
  courier: text("courier"),
  courierTrackingUrl: text("courier_tracking_url"),
  riderName: text("rider_name"),
  riderPlate: text("rider_plate"),
  riderPhone: text("rider_phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Every payment proof a Customer submitted, kept for good with its rejection. The columns on `orders` mirror the latest. */
export const orderPaymentProofs = pgTable("order_payment_proofs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  reference: text("reference"),
  screenshotFileId: text("screenshot_file_id"),
  screenshotPathname: text("screenshot_pathname"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedById: text("rejected_by_id"),
  rejectedByName: text("rejected_by_name"),
  rejectionReason: text("rejection_reason"),
}, (table) => [index("order_payment_proofs_order").on(table.orderId)]);

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
  /** `open`, `resolved` (staff say it is answered) or `completed` (done). */
  status: text("status").notNull().default("open"),
  /** `low`, `normal`, `high` or `urgent`; set by staff in CREOMS. */
  priority: text("priority").notNull().default("normal"),
  /** The staff member working the Ticket: an opaque id from br-auth-service, never a foreign key. */
  claimedById: text("claimed_by_id"),
  /** The Claimer's display name as it was when they claimed the Ticket. */
  claimedByName: text("claimed_by_name"),
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
  index("order_returns_order_id").on(table.orderId),
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
}, table => [index("failed_deliveries_order").on(table.orderId)]);
