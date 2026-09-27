"use client";

export const guestCartStorageKey = "bren-raphaels-guest-cart";
export const guestCartLineQuantityLimit = 10;

export type GuestCartLine = {
  sizeId: number;
  productSlug: string;
  productName: string;
  sizeLabel: string;
  priceInCentavos: number;
  quantity: number;
};

function isGuestCartLine(value: unknown): value is GuestCartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return Number.isInteger(line.sizeId)
    && typeof line.productSlug === "string"
    && typeof line.productName === "string"
    && typeof line.sizeLabel === "string"
    && Number.isInteger(line.priceInCentavos)
    && typeof line.quantity === "number"
    && Number.isInteger(line.quantity)
    && line.quantity > 0;
}

function cap(quantity: number) {
  return Math.min(Math.max(1, quantity), guestCartLineQuantityLimit);
}

export function readGuestCart(): GuestCartLine[] {
  try {
    const saved = window.localStorage.getItem(guestCartStorageKey);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter(isGuestCartLine).map((line) => ({ ...line, quantity: cap(line.quantity) }))
      : [];
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]) {
  window.localStorage.setItem(guestCartStorageKey, JSON.stringify(lines));
}

export function addGuestCartLine(line: GuestCartLine) {
  const lines = readGuestCart();
  const existing = lines.find(({ sizeId }) => sizeId === line.sizeId);
  if (existing) {
    existing.quantity = cap(existing.quantity + line.quantity);
  } else {
    lines.push({ ...line, quantity: cap(line.quantity) });
  }
  writeGuestCart(lines);
}
