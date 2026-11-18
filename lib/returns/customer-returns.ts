import { and, eq, inArray } from "drizzle-orm";
import { completedAtOf, isCompleted } from "../orders/completion";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { customerNotifications, customers, orders, orderLines, orderReturns, orderReturnItems, orderReturnImages, orderReturnHistory } from "../db/schema";
import { positiveIntegerField } from "../validators/fields";
import { fileIdField } from "../validators/file-id";
import { type ReturnEvidenceFiles, validateReturnEvidence } from "./evidence-files";
import { ReturnRequestError, evidenceUploadInput, returnRequestInput } from "./return-input";
import { returnNoticeContent } from "./return-notices";
import { createReturnStore, formatReturnNumber } from "./returns";

/** Customer identity is resolved by the authenticated adapter; prices and names come from the database. */
export function createCustomerReturns<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>, deps: { files: ReturnEvidenceFiles; now?: () => Date },
) {
  const now = deps.now ?? (() => new Date());
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function eligibleOrder(tx: Transaction, customerId: string, orderId: number) {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customerId))).for("update");
    if (!order) throw new ReturnRequestError("Order not found.", 404);
    if (order.status === "received") throw new ReturnRequestError("An Order marked received can no longer be returned.");
    if (!isCompleted(order.status)) throw new ReturnRequestError("Returns are available only for delivered or picked up Orders with confirmed payment.");
    // The Order lifecycle requires GCash to pass paid before delivery. Legacy paid
    // Orders have no paidAt attribution, so that optional timestamp is not a gate.
    if (!["gcash", "cash-on-delivery"].includes(order.paymentMethod)) {
      throw new ReturnRequestError("Payment must be confirmed before requesting a Return.");
    }
    const at = now();
    const elapsed = at.getTime() - (completedAtOf(order)?.getTime() ?? NaN);
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new ReturnRequestError("This Order has no valid delivery time for a Return.");
    if (elapsed >= 24 * 60 * 60 * 1000 * (order.refundWindowExtendedAt ? 2 : 1)) throw new ReturnRequestError("The 24-hour Return window has closed.");
    return { order, at };
  }

  async function selectedLines(tx: Transaction, orderId: number, ids: number[]) {
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(orderLines.id);
    const selected = lines.filter((line) => ids.includes(line.id));
    if (selected.length !== ids.length) throw new ReturnRequestError("Choose whole line items belonging to this Order.", 400);
    const reserved = await tx.select({ id: orderReturnItems.orderLineId }).from(orderReturnItems)
      .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
      .where(and(eq(orderReturns.orderId, orderId), inArray(orderReturnItems.orderLineId, ids),
        inArray(orderReturns.status, ["requested", "approved", "goods received", "refunded", "replaced"])));
    if (reserved.length) throw new ReturnRequestError("An item is already in an active, Refunded or Replaced Return.");
    return { lines, selected, allSelected: selected.length === lines.length };
  }

  async function prepareUpload(customerId: string, orderId: number, input: unknown) {
    const parsed = evidenceUploadInput.parse(input);
    await db.transaction((tx) => eligibleOrder(tx, customerId, orderId));
    return deps.files.prepare({ customerId, orderId }, parsed);
  }

  async function request(customerId: string, orderId: number, input: unknown) {
    const parsed = returnRequestInput.parse(input);
    // Refuse ineligible/overlapping requests before downloading evidence, then recheck at commit.
    await db.transaction(async (tx) => {
      await eligibleOrder(tx, customerId, orderId);
      await selectedLines(tx, orderId, parsed.orderLineIds);
    });
    const owner = { customerId, orderId };
    const photos: { id: string }[] = [];
    for (const token of parsed.photoUploadTokens) {
      const photo = await deps.files.read(owner, "photo", token);
      await validateReturnEvidence(photo.bytes, "photo");
      photos.push({ id: fileIdField.parse(photo.id) });
    }
    const video = parsed.videoUploadToken ? await deps.files.read(owner, "video", parsed.videoUploadToken) : undefined;
    if (video) { fileIdField.parse(video.id); await validateReturnEvidence(video.bytes, "video"); }
    if (new Set(photos.map((photo) => photo.id)).size !== photos.length) throw new ReturnRequestError("Choose each photo only once.", 400);

    return db.transaction(async (tx) => {
      const { order, at } = await eligibleOrder(tx, customerId, orderId);
      const { lines, selected, allSelected } = await selectedLines(tx, orderId, parsed.orderLineIds);
      const [customer] = await tx.select({ name: customers.fullName }).from(customers).where(eq(customers.id, customerId));
      // Allocate any lower historical subtotal across all purchased lines once, in
      // stable id order. Disjoint Returns therefore cannot each claim the same cap.
      const total = lines.reduce((sum, line) => sum + BigInt(line.quantity) * BigInt(line.priceInCentavos), BigInt(0));
      const paid = BigInt(order.subtotalInCentavos) < total ? BigInt(order.subtotalInCentavos) : total;
      let cumulative = BigInt(0);
      let itemAmount = 0;
      for (const line of lines) {
        const previous = cumulative;
        cumulative += BigInt(line.quantity) * BigInt(line.priceInCentavos);
        if (total > BigInt(0) && parsed.orderLineIds.includes(line.id)) {
          itemAmount += Number(cumulative * paid / total - previous * paid / total);
        }
      }
      const amountInCentavos = itemAmount +
        (allSelected && order.fulfillmentMethod === "delivery" ? order.deliveryFeeInCentavos ?? 0 : 0);
      const [created] = await tx.insert(orderReturns).values({ orderId, reason: parsed.reason, note: parsed.note,
        preferredResolution: parsed.preferredResolution, amountInCentavos, videoFileId: video?.id, requestedAt: at }).returning();
      await tx.insert(orderReturnItems).values(selected.map((line) => ({ returnId: created.id, orderLineId: line.id,
        productName: line.productName, sizeLabel: line.sizeLabel, quantity: line.quantity, priceInCentavos: line.priceInCentavos })));
      await tx.insert(orderReturnImages).values(photos.map((photo, index) => ({ returnId: created.id, position: index + 1, fileId: photo.id })));
      await tx.insert(orderReturnHistory).values({ returnId: created.id, status: "requested", actorType: "customer",
        actorId: customerId, actorName: customer.name, occurredAt: at });
      const content = returnNoticeContent(created, "")!;
      await tx.insert(customerNotifications).values({
        idempotencyKey: `return.requested:${created.id}`, orderId, customerId,
        type: "return.requested", title: content.title, body: content.body, link: content.button.link,
      });
      return { ...created, number: formatReturnNumber(created.id) };
    });
  }

  async function cancel(customerId: string, returnId: number) {
    positiveIntegerField("Return ID").parse(String(returnId));
    const [customer] = await db.select({ name: customers.fullName }).from(customers).where(eq(customers.id, customerId));
    if (!customer) throw new ReturnRequestError("Return not found.", 404);
    return createReturnStore(db, { now }).transition(returnId, { type: "customer", id: customerId, name: customer.name }, { status: "cancelled" });
  }

  return { prepareUpload, request, cancel };
}
