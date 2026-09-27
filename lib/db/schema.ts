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
