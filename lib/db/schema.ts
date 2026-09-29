import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
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
    // This is a Vercel Blob URL, never a URL from the former Shopify shop.
    url: text("url").notNull(),
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
  // GCash Payment proof: a reference number and optional screenshot the Customer
  // submits once the Order is confirmed. This app stores it but never verifies
  // it or marks the Order paid itself — that happens via the internal API.
  gcashReferenceNumber: text("gcash_reference_number"),
  paymentProofScreenshotPathname: text("payment_proof_screenshot_pathname"),
  paymentProofSubmittedAt: timestamp("payment_proof_submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  status: text("status").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** One row per IP address, holding its most recent submission times so the window truly rolls. */
export const feedbackRateLimits = pgTable("feedback_rate_limits", {
  ipAddress: text("ip_address").primaryKey(),
  submissionTimes: timestamp("submission_times", { withTimezone: true }).array().notNull(),
});
