"use server";

import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore } from "@/lib/orders/cart";
import { z } from "zod";

const cartLineInput = z.object({
  sizeId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const cartLineUpdateInput = z.object({
  lineId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

async function currentCustomerId() {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") {
    throw new Error("Sign in and complete your details to save a Cart.");
  }
  return visitor.customer.userId;
}

export async function getPersistedCart() {
  return createCartStore(getDatabase()).get(await currentCustomerId());
}

export async function addSizeToCart(sizeId: number, quantity: number) {
  const input = cartLineInput.parse({ sizeId, quantity });
  return createCartStore(getDatabase()).addSize(await currentCustomerId(), input.sizeId, input.quantity);
}

export async function updateCartLine(lineId: number, quantity: number) {
  const input = cartLineUpdateInput.parse({ lineId, quantity });
  return createCartStore(getDatabase()).updateLine(await currentCustomerId(), input.lineId, input.quantity);
}

export async function removeCartLine(lineId: number) {
  return createCartStore(getDatabase()).removeLine(
    await currentCustomerId(),
    z.number().int().positive().parse(lineId),
  );
}

export async function mergeGuestCart(lines: { sizeId: number; quantity: number }[]) {
  return createCartStore(getDatabase()).mergeGuestCart(
    await currentCustomerId(),
    z.array(cartLineInput).max(100).parse(lines),
  );
}
