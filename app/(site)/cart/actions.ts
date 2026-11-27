"use server";

import { refresh } from "next/cache";

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

/** Re-renders the page the Customer is on once a Cart change is saved, so the header's count follows. */
async function thenRefresh<T>(change: Promise<T>) {
  const result = await change;
  refresh();
  return result;
}

export async function getPersistedCart() {
  return createCartStore(getDatabase()).get(await currentCustomerId());
}

export async function addSizeToCart(sizeId: number, quantity: number) {
  const input = cartLineInput.parse({ sizeId, quantity });
  return thenRefresh(createCartStore(getDatabase()).addSize(await currentCustomerId(), input.sizeId, input.quantity));
}

export async function updateCartLine(lineId: number, quantity: number) {
  const input = cartLineUpdateInput.parse({ lineId, quantity });
  return thenRefresh(createCartStore(getDatabase()).updateLine(await currentCustomerId(), input.lineId, input.quantity));
}

export async function removeCartLine(lineId: number) {
  return thenRefresh(createCartStore(getDatabase()).removeLine(
    await currentCustomerId(),
    z.number().int().positive().parse(lineId),
  ));
}

export async function mergeVisitorCart(visitorCartId: string, lines: { sizeId: number; quantity: number }[]) {
  return thenRefresh(createCartStore(getDatabase()).mergeVisitorCart(
    await currentCustomerId(),
    z.string().min(1).max(100).parse(visitorCartId),
    z.array(cartLineInput).max(100).parse(lines),
  ));
}
