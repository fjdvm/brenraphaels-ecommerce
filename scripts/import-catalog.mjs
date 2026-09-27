import { put } from "@vercel/blob";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { productImages, products, sizes } from "../lib/db/schema.ts";

const feedUrl = "https://brenraphaels.com/products.json?limit=250";

function textFromHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6]|li|div|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[rl]squo;/gi, "'")
    .replace(/&[ld]quo;/gi, '"')
    .replace(/&ndash;/gi, "–")
    .replace(/&#(?:x2013|8211);/gi, "–")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function productFromTitle(title) {
  const match = title.trim().match(/^(.*?)(?:\s+)(\d+)\s*g$/i);
  if (!match) throw new Error(`Cannot determine a Size from Shopify title: ${title}`);

  const name = match[1].replace(/\s*-\s*/g, " ").trim();
  // The current feed calls the same Halaya kind both “Tidbits” and “With Tidbits”.
  const key = name.toLowerCase().replace(/\bwith\s+tidbits\b/g, "tidbits");
  return { key, name: toTitleCase(name), size: `${match[2]}g` };
}

function toTitleCase(value) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugFor(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function priceInCentavos(price) {
  const centavos = Math.round(Number(price) * 100);
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error(`Invalid Shopify price: ${price}`);
  }
  return centavos;
}

async function fetchFeed() {
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`Could not fetch Shopify products: ${response.status}`);
  const feed = await response.json();
  if (!Array.isArray(feed.products) || feed.products.length === 0) {
    throw new Error("Shopify product feed was empty.");
  }
  return feed.products;
}

async function uploadImage(sourceUrl, slug, position) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not download product image: ${sourceUrl}`);
  const type = response.headers.get("content-type") || "image/jpeg";
  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const blob = new Blob([await response.arrayBuffer()], { type });
  const uploaded = await put(`catalog/${slug}/${position}.${extension}`, blob, {
    access: "public",
    addRandomSuffix: true,
    contentType: type,
  });
  return uploaded.url;
}

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required.");

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);
  try {
    const [{ value: existingProducts }] = await db.select({ value: count() }).from(products);
    if (existingProducts > 0) {
      throw new Error("Catalog already contains Products; this one-time importer will not overwrite it.");
    }

    const sourceProducts = await fetchFeed();
    const grouped = new Map();
    for (const sourceProduct of sourceProducts) {
      const parsed = productFromTitle(sourceProduct.title);
      const group = grouped.get(parsed.key) || {
        slug: slugFor(parsed.name),
        name: parsed.name,
        description: textFromHtml(sourceProduct.body_html || ""),
        sourceImages: [],
        sizes: [],
      };
      group.sourceImages.push(...(sourceProduct.images || []).map(({ src }) => src));
      for (const variant of sourceProduct.variants || []) {
        group.sizes.push({
          label: variant.title === "Default Title" ? parsed.size : variant.title,
          priceInCentavos: priceInCentavos(variant.price),
          available: Boolean(variant.available),
        });
      }
      grouped.set(parsed.key, group);
    }

    const catalog = [];
    for (const group of grouped.values()) {
      const seenSizes = new Set();
      for (const size of group.sizes) {
        if (seenSizes.has(size.label)) throw new Error(`Duplicate Size ${size.label} for ${group.name}`);
        seenSizes.add(size.label);
      }
      const imageUrls = [...new Set(group.sourceImages)];
      if (imageUrls.length === 0) throw new Error(`${group.name} has no images.`);
      const uploadedImages = [];
      for (const [position, sourceUrl] of imageUrls.entries()) {
        uploadedImages.push(await uploadImage(sourceUrl, group.slug, position));
      }
      catalog.push({ ...group, uploadedImages });
    }

    await db.transaction(async (transaction) => {
      for (const product of catalog) {
        await transaction.insert(products).values({
          slug: product.slug,
          name: product.name,
          description: product.description,
        });
        await transaction.insert(productImages).values(
          product.uploadedImages.map((url, position) => ({
            productSlug: product.slug,
            url,
            alt: product.name,
            position,
          })),
        );
        await transaction.insert(sizes).values(
          product.sizes.map((size) => ({ productSlug: product.slug, ...size })),
        );
      }
    });
    console.log(`Imported ${catalog.length} Products from ${sourceProducts.length} Shopify records.`);
  } finally {
    await client.end();
  }
}

await main();
