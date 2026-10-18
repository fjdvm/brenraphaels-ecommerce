"use client";

import { cartLineQuantityLimit } from "./quantity";

export const visitorCartStorageKey = "bren-raphaels-visitor-cart";
const visitorCartIdStorageKey = "bren-raphaels-visitor-cart-id";

export type VisitorCartLine = {
  sizeId: number;
  productSlug: string;
  productName: string;
  sizeLabel: string;
  /** Absent on lines saved before photos were kept with them. */
  imageUrl?: string;
  priceInCentavos: number;
  quantity: number;
};

function isVisitorCartLine(value: unknown): value is VisitorCartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return Number.isInteger(line.sizeId)
    && typeof line.productSlug === "string"
    && typeof line.productName === "string"
    && typeof line.sizeLabel === "string"
    && (line.imageUrl === undefined || typeof line.imageUrl === "string")
    && Number.isInteger(line.priceInCentavos)
    && typeof line.quantity === "number"
    && Number.isInteger(line.quantity)
    && line.quantity > 0;
}

function cap(quantity: number) {
  return Math.min(Math.max(1, quantity), cartLineQuantityLimit);
}

export function readVisitorCart(): VisitorCartLine[] {
  try {
    const saved = window.localStorage.getItem(visitorCartStorageKey);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter(isVisitorCartLine).map((line) => ({ ...line, quantity: cap(line.quantity) }))
      : [];
  } catch {
    return [];
  }
}

export function writeVisitorCart(lines: VisitorCartLine[]) {
  window.localStorage.setItem(visitorCartStorageKey, JSON.stringify(lines));
}

export function visitorCartId() {
  const saved = window.localStorage.getItem(visitorCartIdStorageKey);
  if (saved) return saved;
  const id = crypto.randomUUID();
  window.localStorage.setItem(visitorCartIdStorageKey, id);
  return id;
}

export function clearVisitorCart() {
  window.localStorage.removeItem(visitorCartStorageKey);
  window.localStorage.removeItem(visitorCartIdStorageKey);
}

export function addVisitorCartLine(line: VisitorCartLine) {
  const lines = readVisitorCart();
  const existing = lines.find(({ sizeId }) => sizeId === line.sizeId);
  if (existing) {
    existing.quantity = cap(existing.quantity + line.quantity);
  } else {
    lines.push({ ...line, quantity: cap(line.quantity) });
  }
  writeVisitorCart(lines);
}
