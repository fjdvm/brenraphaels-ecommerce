import { confirmedProofInput } from "./payment-proof";
import { after } from "next/server";
import { createStockReservations } from "./stock-reservations";
import { gatewayShopStock, type ShopStock } from "./stock";
import { gatewayProductImages, productThumbnail, type ProductImageFiles, type ProductImageReference } from "../catalog/product-images";
import { and, asc, desc, eq, inArray, isNull, isNotNull, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderCancellations, failedDeliveries, addresses, cartLines, customerNotifications, customers, orderCancelledItems, orderDeliveryAddresses, orderLines, orderPaymentProofs, orders, productImages, products, stockOutbox } from "../db/schema";
import { courierBooking, type CourierBooking } from "../validators/courier";
import { referenceProblem } from "./payment-proof";
import { fileIdField } from "../validators/file-id";
import { staffAttribution } from "../validators/staff";
import { createCartStore } from "./cart";
import { seniorPwdDiscount, type IdType } from "../senior-pwd/id-number";
import { activeVerification, submitVerification } from "../senior-pwd/store";
import type { AuditEvent } from "../audit/gateway";

export { paymentMethods, prepaidMethods, MANAGER_AFTER_REJECTIONS, isPrepaid, type PaymentMethod } from "./payment-methods";
import { isPrepaid, MANAGER_AFTER_REJECTIONS, type PaymentMethod } from "./payment-methods";

export const fulfillmentMethods = ["pickup", "delivery"] as const;

export type FulfillmentMethod = (typeof fulfillmentMethods)[number];
export const orderStatuses = [
  "placed",
  "confirmed",
  "awaiting payment",
  "paid",
  "preparing",
  "dispatched",
  "delivered",
  "received",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export class OrderStatusUpdateError extends Error {}

/** The requested status does not follow the Order lifecycle. */
export class OrderTransitionError extends OrderStatusUpdateError {
  constructor(nextStatus: OrderStatus, currentStatus: OrderStatus) {
    super(`\"${nextStatus}\" is not a legal transition from \"${currentStatus}\".`);
    this.name = "OrderTransitionError";
  }
}

export type OrderLine = {
  productName: string;
  /** The Product's first photo today, matched by name since lines are immutable copies; null once the Product is gone or renamed. */
  imageUrl: string | null;
  sizeLabel: string;
  priceInCentavos: number;
  quantity: number;
};

/** The immutable destination retained for a Delivery Order. */
export type DeliveryAddress = {
  label: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

/** A GCash reference number, and optionally a screenshot, submitted as evidence of payment. */
export type PaymentProof = {
  gcashReferenceNumber: string;
  /** Legacy Vercel Blob pathname, for proofs submitted before file-storage. */
  screenshotPathname: string | null;
  /** Private File id in file-storage, for newer proofs. */
  screenshotFileId: string | null;
  submittedAt: Date;
};

export type Order = {
  id: number;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  subtotalInCentavos: number;
  // Pickup Orders never have one; Delivery Orders get theirs once staff quote it.
  deliveryFeeInCentavos: number | null;
  packedBy?: { id: string; name: string; at: Date } | null;
  paidById: string | null;
  paidByName: string | null;
  paidAt: Date | null;
  /** File id of the Delivery photo; null before delivery, for legacy Orders, or after retention removes it. */
  deliveryPhotoFileId: string | null;
  deliveryPhotoRemovedAt: Date | null;
  /** The booking recorded at dispatch of a Delivery Order; null for Pickup and before dispatch. */
  courier: { name: "Lalamove" | "Grab"; trackingUrl: string; riderName: string | null; riderPlate: string | null; riderPhone: string | null } | null;
  createdAt: Date;
  lines: OrderLine[];
  deliveryAddress: DeliveryAddress | null;
  // Only ever set for a GCash Order, once the Customer submits it.
  paymentProof: PaymentProof | null;
  /** Why the latest proof was turned down; null while it waits for a check or after a new one arrives. */
  paymentProofRejection?: { reason: string; at: Date } | null;
  /** Proofs rejected so far. */
  paymentProofRejections?: number;
  /** Every proof sent, oldest first, with why each rejected one was not accepted. */
  paymentProofHistory?: { reference: string | null; submittedAt: Date; rejection: { reason: string; at: Date } | null }[];
};

export type PlaceOrderInput = {
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  /** Required for Delivery and ignored for Pickup. */
  addressId?: number;
  /**
   * The Senior Citizen / PWD discount: which Cart line gets 5% off one unit. A Customer with an approved ID
   * sends only the line; otherwise the ID type, number and the uploaded photo(s) are needed too.
   */
  seniorPwd?: { lineId: number; idType?: IdType; idNumber?: string; photoFileId?: string; photoBackFileId?: string };
};

export type SubmitPaymentProofInput = {
  confirmedAmountInCentavos?: number;
  confirmedPaidAt?: Date;
  confirmedRecipient?: string;
  /** Set by the server from the shop payment settings, never from browser input. */
  expectedRecipient?: string;
  gcashReferenceNumber: string;
  screenshotFileId?: string;
};

/** Where an Order's payment-proof screenshot lives: file-storage, or legacy Vercel Blob. */
export type StoredPaymentScreenshot = { fileId: string } | { pathname: string };

export type AdvanceOrderInput = {
  status: OrderStatus;
  deliveryFeeInCentavos?: number;
  deliveryPhotoFileId?: string;
  courier?: CourierBooking;
  staffId?: string;
  staffName?: string;
  /** Needed to mark paid once 3 proofs have been rejected; a Manager's reason. */
  approvedAnyway?: { reason: string };
};

export type OrderStore = {
  place(
    customerId: string,
    input: PlaceOrderInput,
  ): Promise<Order>;
  listForCustomer(customerId: string): Promise<Order[]>;
  advance(
    orderId: number,
    input: AdvanceOrderInput,
  ): Promise<Order>;
  cancel(customerId: string, orderId: number): Promise<Order>;
  cancelItems(orderId: number, lineIds: number[], staff: { staffId: string; staffName: string }, expectedStatus: string): Promise<Order>;
  customerEmailForOrder(orderId: number): Promise<string | undefined>;
  customerIdForOrder(orderId: number): Promise<string | undefined>;
  submitPaymentProof(
    customerId: string,
    orderId: number,
    input: SubmitPaymentProofInput,
  ): Promise<Order>;
  getPaymentProofScreenshot(customerId: string, orderId: number): Promise<StoredPaymentScreenshot | undefined>;
  /** Staff turn down the latest proof: it is kept with the reason, and the Customer is told to upload again. */
  rejectPaymentProof(orderId: number, input: { reason: string; staffId: string; staffName: string }): Promise<{ order: Order; rejections: number }>;
};

export type OrderMailer = {
  send(recipientEmail: string, order: Order): Promise<void>;
};

/**
 * Places the Order and then notifies the Customer. The Order is already
 * persisted and the Cart already emptied by the time the email is sent, so a
 * failed or slow confirmation email must not be reported as a failed checkout.
 */
export async function placeOrderAndNotify(
  customerId: string,
  recipientEmail: string,
  input: PlaceOrderInput,
  dependencies: { orderStore: OrderStore; mailer: OrderMailer; audit?: (event: AuditEvent) => Promise<void> },
): Promise<Order> {
  const order = await dependencies.orderStore.place(customerId, input);
  if (order.fulfillmentMethod === "delivery" && order.subtotalInCentavos > 250_000 && order.deliveryFeeInCentavos === 0) {
    try {
      await dependencies.audit?.({
        source: "Ecommerce", action: "free_delivery.applied", outcome: "success",
        actor: { type: "system", id: "free-delivery", display_name: "Free delivery" },
        target: { type: "order", id: String(order.id), display_name: `Order #${order.id}` },
        description: `Free delivery applied to Order #${order.id}; subtotal is over ₱2,500. No quote is needed.`,
        occurred_at: order.createdAt.toISOString(), idempotency_key: `free_delivery.applied:${order.id}`,
      });
    } catch (error) {
      console.error("Free delivery audit event could not be written", error);
    }
  }
  try {
    await dependencies.mailer.send(recipientEmail, order);
  } catch (error) {
    console.error("Order-placed email could not be sent", error);
  }
  return order;
}

function paymentNeededNotification(order: typeof orders.$inferSelect) {
  return {
    idempotencyKey: `order.payment-needed:${order.id}`, orderId: order.id, customerId: order.customerId,
    type: "order.payment-needed", title: `Payment needed for Order #${order.id}`,
    body: "Please submit your payment reference number to continue your Order.",
    link: `/profile/orders?order=${order.id}`,
  };
}

export function createOrderStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, files: ProductImageFiles = gatewayProductImages(), stock: ShopStock = gatewayShopStock(),
  defer: (work: () => Promise<void>) => void = work => after(work),
): OrderStore {
  const reservations = createStockReservations(db, stock);
  /** The same stock without reads, for use while rows are locked. */
  const unread: ShopStock = { ...stock, left: async () => { throw new Error("not read under lock"); }, read: async () => { throw new Error("not read under lock"); } };
  function deferRelease(id: string | undefined) {
    if (!id) return;
    try { defer(async () => { await reservations.drain(new Date(), id); }); }
    catch (error) { console.error("Stock release remains queued for the scheduled job", error); }
  }
  async function linesForOrder(orderId: number): Promise<OrderLine[]> {
    const lines = await db
      .select({
        productName: orderLines.productName,
        image: sql<ProductImageReference | null>`(select json_build_object('productSlug', ${productImages.productSlug}, 'fileId', ${productImages.fileId}, 'url', ${productImages.url}) from ${productImages} inner join ${products} on ${products.slug} = ${productImages.productSlug} where ${products.name} = ${orderLines.productName} order by ${productImages.position} asc limit 1)`,
        sizeLabel: orderLines.sizeLabel,
        priceInCentavos: orderLines.priceInCentavos,
        quantity: orderLines.quantity,
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId))
      .orderBy(asc(orderLines.id));
    return Promise.all(lines.map(async ({ image, ...line }) => ({ ...line, imageUrl: await productThumbnail(image, files) })));
  }

  async function deliveryAddressForOrder(orderId: number): Promise<DeliveryAddress | null> {
    const [address] = await db
      .select({
        label: orderDeliveryAddresses.label,
        street: orderDeliveryAddresses.street,
        barangay: orderDeliveryAddresses.barangay,
        city: orderDeliveryAddresses.city,
        province: orderDeliveryAddresses.province,
        postalCode: orderDeliveryAddresses.postalCode,
        country: orderDeliveryAddresses.country,
      })
      .from(orderDeliveryAddresses)
      .where(eq(orderDeliveryAddresses.orderId, orderId));
    return address ?? null;
  }

  async function toOrder(row: typeof orders.$inferSelect, lines: OrderLine[]): Promise<Order> {
    let paymentProofRejection: Order["paymentProofRejection"] = null;
    if (row.paymentProofRejectedAt) {
      const [latest] = await db.select({ reason: orderPaymentProofs.rejectionReason }).from(orderPaymentProofs)
        .where(and(eq(orderPaymentProofs.orderId, row.id), isNotNull(orderPaymentProofs.rejectedAt))).orderBy(desc(orderPaymentProofs.id)).limit(1);
      paymentProofRejection = { reason: latest?.reason ?? "", at: row.paymentProofRejectedAt };
    }
    let paymentProofHistory: Order["paymentProofHistory"] = [];
    if (row.paymentProofSubmittedAt) {
      const proofs = await db.select().from(orderPaymentProofs).where(eq(orderPaymentProofs.orderId, row.id)).orderBy(asc(orderPaymentProofs.submittedAt), asc(orderPaymentProofs.id));
      paymentProofHistory = proofs.map((proof) => ({
        reference: proof.reference, submittedAt: proof.submittedAt,
        rejection: proof.rejectedAt ? { reason: proof.rejectionReason ?? "", at: proof.rejectedAt } : null,
      }));
    }
    return {
      id: row.id,
      paymentProofHistory,
      paymentProofRejection,
      paymentProofRejections: row.paymentProofRejections,
      fulfillmentMethod: row.fulfillmentMethod as FulfillmentMethod,
      paymentMethod: row.paymentMethod as PaymentMethod,
      status: row.status as OrderStatus,
      subtotalInCentavos: row.subtotalInCentavos,
      deliveryFeeInCentavos: row.deliveryFeeInCentavos,
      packedBy: row.packedById && row.packedByName && row.packedAt ? { id: row.packedById, name: row.packedByName, at: row.packedAt } : null,
      paidById: row.paidById,
      paidByName: row.paidByName,
      paidAt: row.paidAt,
      deliveryPhotoFileId: row.deliveryPhotoFileId,
      deliveryPhotoRemovedAt: row.deliveryPhotoRemovedAt,
      courier: row.courier === null || row.courierTrackingUrl === null ? null : {
        name: row.courier as "Lalamove" | "Grab", trackingUrl: row.courierTrackingUrl,
        riderName: row.riderName, riderPlate: row.riderPlate, riderPhone: row.riderPhone,
      },
      createdAt: row.createdAt,
      lines,
      deliveryAddress: await deliveryAddressForOrder(row.id),
      paymentProof: row.gcashReferenceNumber === null || row.paymentProofSubmittedAt === null
        ? null
        : {
          gcashReferenceNumber: row.gcashReferenceNumber,
          screenshotPathname: row.paymentProofScreenshotPathname,
          screenshotFileId: row.paymentProofFileId,
          submittedAt: row.paymentProofSubmittedAt,
        },
    };
  }

  async function listForCustomer(customerId: string): Promise<Order[]> {
    const persistedOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt), desc(orders.id));

    return Promise.all(
      persistedOrders.map(async (order) => toOrder(order, await linesForOrder(order.id))),
    );
  }

  /** Persist intent before IMS writes: cancellation must never release partly deducted stock. */
  async function pack(orderId: number, input: AdvanceOrderInput): Promise<Order> {
    if (input.deliveryFeeInCentavos !== undefined) throw new OrderStatusUpdateError("A Delivery fee can only be set when confirming a Delivery Order.");
    const staff = staffAttribution.parse(input);
    if (input.courier !== undefined || input.deliveryPhotoFileId !== undefined) {
      throw new OrderStatusUpdateError("Packing does not accept courier, Delivery photo or fee changes.");
    }
    await db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) throw new OrderStatusUpdateError("Order was not found.");
      if (order.deliveryFeeQuoteRequired) throw new OrderStatusUpdateError("Quote a Delivery fee before continuing this Order.");
      if (!(order.status === "paid" || order.status === "confirmed" && order.paymentMethod === "cash-on-delivery")) {
        throw new OrderStatusUpdateError("Only a paid or confirmed Cash on Delivery Order can be packed.");
      }
      if (!order.packingStartedAt) await tx.update(orders).set({
        packingStartedAt: new Date(),
      }).where(eq(orders.id, orderId));
    });
    const packed = await db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (order.packedAt || !["paid", "confirmed"].includes(order.status)) throw new OrderStatusUpdateError("Order already changed. Refresh before retrying.");
      await createStockReservations(tx, stock).deduct(orderId);
      const [updated] = await tx.update(orders).set({ status: "preparing", packedAt: new Date(), packedById: staff.staffId, packedByName: staff.staffName }).where(eq(orders.id, orderId)).returning();
      const key = `order:${orderId}:order.packed`;
      await tx.insert(stockOutbox).values({ key, kind: "audit", payload: {
        source: "Ecommerce", action: "order.packed", outcome: "success",
        actor: { type: "staff", id: staff.staffId, display_name: staff.staffName },
        target: { type: "order", id: String(orderId), display_name: `Order #${orderId}` },
        description: `${staff.staffName} packed Order #${orderId}.`,
        occurred_at: updated.packedAt!.toISOString(), idempotency_key: key,
      } satisfies AuditEvent }).onConflictDoNothing();
      return updated;
    });
    return toOrder(packed, await linesForOrder(orderId));
  }

  async function advance(
    orderId: number,
    input: AdvanceOrderInput,
  ): Promise<Order> {
    if (input.status === "preparing") return pack(orderId, input);
    const [persistedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!persistedOrder) throw new OrderStatusUpdateError("Order was not found.");

    if (persistedOrder.fulfillmentMethod === "delivery" && persistedOrder.subtotalInCentavos > 250_000 &&
        input.deliveryFeeInCentavos !== undefined && input.deliveryFeeInCentavos !== 0) {
      throw new OrderStatusUpdateError("Free delivery applies to this Order. The Delivery fee must be ₱0.");
    }
    if (input.status === "delivered" && persistedOrder.deliveryPhotoFileId !== null) {
      throw new OrderStatusUpdateError("Delivery photo is already set.");
    }
    if (input.status !== "delivered" && input.deliveryPhotoFileId !== undefined) {
      throw new OrderStatusUpdateError("A Delivery photo can only be set when marking an Order delivered.");
    }

    if (input.courier !== undefined && input.status !== "dispatched") {
      throw new OrderStatusUpdateError("Courier details can only be set when dispatching an Order.");
    }

    const permittedNextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
      placed: ["confirmed", "cancelled"],
      confirmed: isPrepaid(persistedOrder.paymentMethod)
        ? ["awaiting payment", "cancelled"]
        : ["preparing", "cancelled"],
      "awaiting payment": ["paid", "cancelled"],
      paid: ["preparing", "cancelled"],
      preparing: ["dispatched", "cancelled"],
      dispatched: ["delivered"],
      delivered: [],
      received: [],
      cancelled: [],
    };
    const currentStatus = persistedOrder.status as OrderStatus;
    const requote = input.status === "confirmed" && input.deliveryFeeInCentavos !== undefined &&
      persistedOrder.fulfillmentMethod === "delivery" && persistedOrder.deliveryFeeInCentavos === null &&
      ["confirmed", "awaiting payment", "paid", "preparing"].includes(currentStatus);
    if (persistedOrder.deliveryFeeQuoteRequired &&
        !["confirmed", "cancelled"].includes(input.status)) {
      throw new OrderStatusUpdateError("Quote a Delivery fee before continuing this Order.");
    }
    if (!requote && !permittedNextStatuses[currentStatus].includes(input.status)) {
      throw new OrderTransitionError(input.status, currentStatus);
    }
    const deliveryPhotoFileId = input.status === "delivered" ? fileIdField.parse(input.deliveryPhotoFileId) : undefined;
    if (
      input.deliveryFeeInCentavos !== undefined
      && (input.status !== "confirmed" || persistedOrder.fulfillmentMethod !== "delivery")
    ) {
      throw new OrderStatusUpdateError("A Delivery fee can only be set when confirming a Delivery Order.");
    }
    if (
      input.status === "confirmed"
      && persistedOrder.fulfillmentMethod === "delivery"
      && input.deliveryFeeInCentavos === undefined
    ) {
      throw new OrderStatusUpdateError("A confirmed Delivery Order must include its Delivery fee.");
    }

    // Delivery needs a booking; Pickup is unaffected and keeps none.
    let courier: CourierBooking | undefined;
    if (input.status === "dispatched" && persistedOrder.fulfillmentMethod === "delivery") {
      const parsed = courierBooking.safeParse(input.courier);
      if (!parsed.success) throw new OrderStatusUpdateError(input.courier === undefined ? "Dispatching a Delivery Order needs the courier and an https tracking link." : parsed.error.issues[0].message);
      courier = parsed.data;
    } else if (input.courier !== undefined) {
      throw new OrderStatusUpdateError("A Pickup Order has no courier.");
    }

    const staff = input.status === "paid" ? staffAttribution.parse(input) : null;
    if (input.status === "paid") {
      const rejections = persistedOrder.paymentProofRejections;
      if (rejections >= MANAGER_AFTER_REJECTIONS) {
        if (!input.approvedAnyway?.reason.trim()) throw new OrderStatusUpdateError("After 3 rejected proofs a Manager must approve this payment anyway, with a reason.");
      } else if (persistedOrder.paymentProofRejectedAt) {
        throw new OrderStatusUpdateError("This proof was rejected. Wait for the Customer to send another.");
      }
    }
    let releaseId: string | undefined;
    const updatedOrder = await db.transaction(async (transaction) => {
      // Serialize delivery with failed-attempt decisions and refuse disposed goods.
      await transaction.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("update");
      const [cancellation] = await transaction.select().from(orderCancellations).where(eq(orderCancellations.orderId, orderId));
      if (cancellation?.status === "settling") throw new OrderStatusUpdateError("Cancellation settlement has started. Refresh the Order.");
      if (input.status === "delivered") {
        const failed = await transaction.select().from(failedDeliveries).where(eq(failedDeliveries.orderId, orderId));
        if (failed.some(attempt => attempt.disposition || !attempt.rebookedAt)) throw new OrderStatusUpdateError("Handle the failed delivery before marking this Order delivered.");
      }
      const [updatedOrder] = await transaction
        .update(orders)
        .set({
          status: requote ? currentStatus : input.status,
          ...(staff ? { paidById: staff.staffId, paidByName: staff.staffName, paidAt: new Date() } : {}),
          ...(courier ? {
            courier: courier.name, courierTrackingUrl: courier.trackingUrl,
            riderName: courier.riderName || null, riderPlate: courier.riderPlate || null, riderPhone: courier.riderPhone || null,
          } : {}),
          ...(input.status === "delivered" ? { deliveredAt: new Date(), deliveryPhotoFileId } : {}),
          ...(input.deliveryFeeInCentavos === undefined
            ? {}
            : { deliveryFeeInCentavos: input.deliveryFeeInCentavos }),
        })
        // Keep a concurrent update from overwriting a status that was just advanced.
        .where(and(
          eq(orders.id, orderId), eq(orders.status, currentStatus),
          ...(input.status === "cancelled" ? [or(isNull(orders.packingStartedAt), isNotNull(orders.packedAt))] : []),
          eq(orders.subtotalInCentavos, persistedOrder.subtotalInCentavos),
          ...(requote ? [isNull(orders.deliveryFeeInCentavos)] : []),
          ...(input.status === "delivered" ? [isNull(orders.deliveryPhotoFileId)] : []),
        ))
        .returning();
      if (!updatedOrder) throw new OrderStatusUpdateError("Order status or Delivery photo changed before it could be advanced. Refresh before retrying.");

      if (input.status === "cancelled") {
        const attribution = input.staffId !== undefined || input.staffName !== undefined ? staffAttribution.parse(input) : null;
        releaseId = await createStockReservations(transaction, stock).releaseItems(orderId, undefined,
          attribution ? { type: "staff", id: attribution.staffId, display_name: attribution.staffName } : undefined);
      }
      if (input.status === "delivered") {
        await transaction.insert(customerNotifications).values({
          idempotencyKey: `order.delivered:${updatedOrder.id}`,
          orderId: updatedOrder.id,
          customerId: updatedOrder.customerId,
          type: "order.delivered",
          title: `Your Order #${updatedOrder.id} was delivered`,
          body: "Your Order was delivered. Your Refund window is 24 hours from delivery to request a Return. Marking the Order received closes the window early.",
          link: `/profile/orders?order=${updatedOrder.id}`,
        });
      }
      const content = input.status === "confirmed" && updatedOrder.fulfillmentMethod === "delivery"
        ? { type: "order.delivery-fee", title: `Delivery fee quoted for Order #${orderId}`, body: `Your Delivery fee is ₱${((updatedOrder.deliveryFeeInCentavos ?? 0) / 100).toFixed(2)}. View your confirmed Order.` }
        : input.status === "dispatched"
          ? { type: "order.dispatched", title: `Order #${orderId} dispatched`, body: "Your Order has been dispatched. View your Order for details." }
          : input.status === "cancelled"
            ? { type: "order.cancelled", title: `Order #${orderId} cancelled`, body: "Your Order has been cancelled. View your Order for details." }
            : null;
      if (content) await transaction.insert(customerNotifications).values({
        ...content, idempotencyKey: `${content.type}:${orderId}`, orderId,
        customerId: updatedOrder.customerId, link: `/profile/orders?order=${orderId}`,
      }).onConflictDoNothing();
      if (input.status === "confirmed" && updatedOrder.status === "confirmed" && isPrepaid(updatedOrder.paymentMethod)) {
        await transaction.insert(customerNotifications).values(paymentNeededNotification(updatedOrder)).onConflictDoNothing();
      }
      return updatedOrder;
    });

    deferRelease(releaseId);
    return toOrder(updatedOrder, await linesForOrder(updatedOrder.id));
  }

  /** Cancel whole line items atomically; the remaining gross subtotal decides Free delivery. */
  async function cancelItems(orderId: number, lineIds: number[], staff: { staffId: string; staffName: string }, expectedStatus: string): Promise<Order> {
    if (!lineIds.length || new Set(lineIds).size !== lineIds.length ||
        lineIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
      throw new OrderStatusUpdateError("Choose this Order's whole line items to cancel.");
    }
    const actor = staffAttribution.parse(staff);
    let releaseId: string | undefined;
    const changed = await db.transaction(async transaction => {
      const [order] = await transaction.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) throw new OrderStatusUpdateError("Order was not found.");
      if (order.packingStartedAt && !order.packedAt) throw new OrderStatusUpdateError("Packing has started. Items can no longer be cancelled.");
      if (order.status !== expectedStatus) throw new OrderStatusUpdateError("Order already changed; refresh it before trying again.");
      if (!["placed", "confirmed", "awaiting payment", "paid", "preparing"].includes(order.status)) {
        throw new OrderStatusUpdateError("Items can no longer be cancelled on this Order.");
      }
      const lines = await transaction.select().from(orderLines).where(eq(orderLines.orderId, orderId));
      const cancelled = lines.filter(line => lineIds.includes(line.id));
      if (cancelled.length !== lineIds.length) throw new OrderStatusUpdateError("Those items already changed. Refresh the Order.");
      if (cancelled.length === lines.length) throw new OrderStatusUpdateError("Use Cancel Order to cancel every item.");
      const remaining = lines.filter(line => !lineIds.includes(line.id));
      const subtotal = remaining.reduce((sum, line) => sum + line.priceInCentavos * line.quantity, 0);
      // Preserve the cancelled snapshots and actor-independent facts for future reads/auditing.
      await transaction.insert(orderCancelledItems).values(cancelled.map(line => ({
        orderId, orderLineId: line.id, productName: line.productName, sizeLabel: line.sizeLabel,
        priceInCentavos: line.priceInCentavos, quantity: line.quantity,
        staffId: actor.staffId, staffName: actor.staffName,
      })));
      releaseId = await createStockReservations(transaction, stock).releaseItems(orderId, lineIds, { type: "staff", id: actor.staffId, display_name: actor.staffName });
      await transaction.delete(orderLines).where(and(eq(orderLines.orderId, orderId), inArray(orderLines.id, lineIds)));
      const [updated] = await transaction.update(orders).set({ subtotalInCentavos: subtotal })
        .where(eq(orders.id, orderId)).returning();
      await transaction.insert(customerNotifications).values({
        idempotencyKey: `order.items-cancelled:${orderId}:${[...lineIds].sort((a,b) => a-b).join("-")}`,
        orderId, customerId: order.customerId, type: "order.items-cancelled",
        title: `Items cancelled on Order #${orderId}`,
        body: updated.fulfillmentMethod === "delivery" && updated.deliveryFeeInCentavos === null
          ? "Items were cancelled. A new Delivery fee quote is needed before your Order is confirmed."
          : "Items were cancelled. View your updated Order.",
        link: `/profile/orders?order=${orderId}`,
      });
      return updated;
    });
    deferRelease(releaseId);
    return toOrder(changed, await linesForOrder(orderId));
  }

  /** Cancels an Order only when it belongs to the Customer and the state machine permits it. */
  async function cancel(customerId: string, orderId: number): Promise<Order> {
    const [persistedOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)));
    if (!persistedOrder) throw new Error("Order was not found.");

    return advance(persistedOrder.id, { status: "cancelled" });
  }

  /**
   * Records the Customer's GCash reference number (and optional screenshot)
   * and moves the Order from `confirmed` to `awaiting payment`. Staff verify
   * it and mark the Order `paid` later, via the internal endpoint.
   */
  async function submitPaymentProof(
    customerId: string,
    orderId: number,
    input: SubmitPaymentProofInput,
  ): Promise<Order> {
    const [persistedOrder] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)));
    if (!persistedOrder) throw new Error("Order was not found.");
    if (!isPrepaid(persistedOrder.paymentMethod)) {
      throw new Error("Payment proof can only be submitted for a GCash, Maya or bank transfer Order.");
    }
    if (persistedOrder.deliveryFeeQuoteRequired) {
      throw new Error("Quote a Delivery fee before submitting Payment proof.");
    }
    const confirmed = confirmedProofInput.parse(input);
    const problem = referenceProblem(persistedOrder.paymentMethod, input.gcashReferenceNumber);
    if (problem) throw new Error(problem);
    const resubmission = persistedOrder.status === "awaiting payment" && persistedOrder.paymentProofRejectedAt !== null;
    if (persistedOrder.status !== "confirmed" && !resubmission) {
      throw new Error(persistedOrder.status === "awaiting payment"
        ? "Your payment proof is being checked. You can upload again if it is not accepted."
        : "Payment proof can only be submitted for a confirmed Order.");
    }

    const submittedAt = new Date();
    const updatedOrder = await db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(orders)
        .set({
          status: "awaiting payment",
          gcashReferenceNumber: input.gcashReferenceNumber,
          paymentProofFileId: input.screenshotFileId ?? null,
          paymentProofScreenshotPathname: null,
          paymentProofSubmittedAt: submittedAt,
          paymentProofRejectedAt: null,
        })
        // Keep a concurrent submission from overwriting one that just landed.
        .where(and(
          eq(orders.id, orderId), eq(orders.status, persistedOrder.status),
          resubmission ? isNotNull(orders.paymentProofRejectedAt) : isNull(orders.paymentProofRejectedAt),
          eq(orders.subtotalInCentavos, persistedOrder.subtotalInCentavos),
          persistedOrder.deliveryFeeInCentavos === null ? isNull(orders.deliveryFeeInCentavos) : eq(orders.deliveryFeeInCentavos, persistedOrder.deliveryFeeInCentavos),
        ))
        .returning();
      if (!updated) return undefined;
      await transaction.insert(orderPaymentProofs).values({
        orderId, reference: input.gcashReferenceNumber, screenshotFileId: input.screenshotFileId ?? null, submittedAt,
        confirmedAmountInCentavos: confirmed.confirmedAmountInCentavos ?? null,
        confirmedPaidAt: confirmed.confirmedPaidAt ?? null,
        confirmedRecipient: confirmed.confirmedRecipient ?? null,
        expectedRecipient: input.expectedRecipient ?? null,
      });
      return updated;
    });
    if (!updatedOrder) throw new Error("Order status changed before payment proof could be submitted.");

    return toOrder(updatedOrder, await linesForOrder(updatedOrder.id));
  }

  async function rejectPaymentProof(orderId: number, input: { reason: string; staffId: string; staffName: string }): Promise<{ order: Order; rejections: number }> {
    const actor = staffAttribution.parse(input);
    const reason = input.reason.trim();
    if (!reason) throw new OrderStatusUpdateError("Enter a reason for rejecting the proof.");
    const updatedOrder = await db.transaction(async (transaction) => {
      const [order] = await transaction.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) throw new OrderStatusUpdateError("Order was not found.");
      if (order.status !== "awaiting payment" || !isPrepaid(order.paymentMethod) || !order.paymentProofSubmittedAt || order.paymentProofRejectedAt) {
        throw new OrderStatusUpdateError("Order already changed; refresh it before trying again.");
      }
      const rejectedAt = new Date();
      const [latest] = await transaction.select({ id: orderPaymentProofs.id }).from(orderPaymentProofs)
        .where(and(eq(orderPaymentProofs.orderId, orderId), isNull(orderPaymentProofs.rejectedAt))).orderBy(desc(orderPaymentProofs.id)).limit(1);
      if (!latest) throw new OrderStatusUpdateError("Order already changed; refresh it before trying again.");
      await transaction.update(orderPaymentProofs).set({
        rejectedAt, rejectedById: actor.staffId, rejectedByName: actor.staffName, rejectionReason: reason,
      }).where(eq(orderPaymentProofs.id, latest.id));
      const [updated] = await transaction.update(orders).set({
        paymentProofRejectedAt: rejectedAt, paymentProofRejections: order.paymentProofRejections + 1,
      }).where(eq(orders.id, orderId)).returning();
      await transaction.insert(customerNotifications).values({
        idempotencyKey: `order.payment-rejected:${orderId}:${updated.paymentProofRejections}`, orderId, customerId: order.customerId,
        type: "order.payment-rejected", title: `Payment proof not accepted for Order #${orderId}`,
        body: `Your payment proof was not accepted: ${reason} Please upload it again.`,
        link: `/profile/orders?order=${orderId}`,
      }).onConflictDoNothing();
      return updated;
    });
    return { order: await toOrder(updatedOrder, await linesForOrder(updatedOrder.id)), rejections: updatedOrder.paymentProofRejections };
  }

  /** The Customer's own payment-proof screenshot: its File id, else a legacy Blob pathname. */
  async function getPaymentProofScreenshot(customerId: string, orderId: number): Promise<StoredPaymentScreenshot | undefined> {
    const [row] = await db
      .select({ fileId: orders.paymentProofFileId, pathname: orders.paymentProofScreenshotPathname })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)));
    if (row?.fileId) return { fileId: row.fileId };
    if (row?.pathname) return { pathname: row.pathname };
    return undefined;
  }

  async function customerEmailForOrder(orderId: number): Promise<string | undefined> {
    const [customer] = await db
      .select({ email: customers.email })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId));
    return customer?.email;
  }

  async function customerIdForOrder(orderId: number): Promise<string | undefined> {
    const [order] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, orderId));
    return order?.customerId;
  }

  async function place(
    customerId: string,
    input: PlaceOrderInput,
  ): Promise<Order> {
    // Read stock before any lock is taken, so a slow IMS never holds Customer or Cart rows. The reserve below stays authoritative.
    const checked = await createCartStore(db, files, stock).get(customerId);
    const blocked = checked.lines.find((line) => !line.available);
    if (blocked) {
      // Say which item and why, so the Customer knows what to change.
      throw new Error(blocked.blockedByStock
        ? `${blocked.productName} (${blocked.sizeLabel}): ${blocked.blockedReason}` : "This Size is unavailable.");
    }
    const attemptId = await reservations.begin(customerId, checked);
    try {
    return await db.transaction(async (transaction) => {
      // Serialize checkouts of the same Cart before reading its current contents.
      await transaction.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update");
      await transaction.select({ id: cartLines.id }).from(cartLines).where(eq(cartLines.customerId, customerId)).for("update");
      const transactionalCart = createCartStore(transaction, files, unread);
      const cart = await transactionalCart.get(customerId);
      if (cart.lines.length === 0) {
        throw new Error("Your Cart is empty.");
      }
      let deliveryAddress: DeliveryAddress | null = null;
      if (input.fulfillmentMethod === "delivery") {
        if (!input.addressId) {
          throw new Error("Choose an Address for Delivery.");
        }
        const [chosenAddress] = await transaction
          .select({
            label: addresses.label,
            street: addresses.street,
            barangay: addresses.barangay,
            city: addresses.city,
            province: addresses.province,
            postalCode: addresses.postalCode,
            country: addresses.country,
          })
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), eq(addresses.customerId, customerId)));
        if (!chosenAddress) {
          throw new Error("Choose one of your saved Addresses for Delivery.");
        }
        deliveryAddress = chosenAddress;
      }

      // The 5% discount: an approved ID applies now; otherwise the ID goes to Staff and the Order waits for them.
      let seniorPwdVerificationId: number | null = null;
      let seniorPwdDiscountInCentavos: number | null = null;
      let waitingForIdCheck = false;
      if (input.seniorPwd) {
        const line = cart.lines.find((candidate) => candidate.id === input.seniorPwd!.lineId);
        if (!line) throw new Error("Choose one item from your Cart for the discount.");
        const approved = await activeVerification(transaction, customerId);
        if (approved) {
          seniorPwdVerificationId = approved.id;
        } else {
          const { idType, idNumber, photoFileId, photoBackFileId } = input.seniorPwd;
          if (!idType || !idNumber || !photoFileId) throw new Error("Add the type, number and a photo of your ID to get the discount.");
          seniorPwdVerificationId = await submitVerification(transaction, customerId, { idType, idNumber, photoFileId, photoBackFileId });
          waitingForIdCheck = true;
        }
        seniorPwdDiscountInCentavos = seniorPwdDiscount(line.priceInCentavos);
      }

      await createStockReservations(transaction, stock).reserve(attemptId, cart);
      const freeDelivery = input.fulfillmentMethod === "delivery" && cart.subtotalInCentavos > 250_000;
      const [order] = await transaction
        .insert(orders)
        .values({
          customerId,
          fulfillmentMethod: input.fulfillmentMethod,
          paymentMethod: input.paymentMethod,
          // The undiscounted Cart subtotal determines Free delivery.
          // An Order whose ID is still being checked is never confirmed automatically.
          status: (input.fulfillmentMethod === "delivery" && !freeDelivery) || waitingForIdCheck ? "placed" : "confirmed",
          seniorPwdVerificationId,
          seniorPwdDiscountInCentavos,
          subtotalInCentavos: cart.subtotalInCentavos,
          deliveryFeeInCentavos: freeDelivery ? 0 : null,
        })
        .returning();

      const insertedLines = await transaction.insert(orderLines).values(cart.lines.map((line) => ({
        orderId: order.id,
        productName: line.productName,
        sizeLabel: line.sizeLabel,
        priceInCentavos: line.priceInCentavos,
        quantity: line.quantity,
      }))).returning({ id: orderLines.id });
      await createStockReservations(transaction, stock).commit(attemptId, order.id, insertedLines.map(line => line.id));
      if (deliveryAddress) {
        await transaction.insert(orderDeliveryAddresses).values({ orderId: order.id, ...deliveryAddress });
      }
      // Only submitted lines are consumed; additions in another tab remain in the Cart.
      await transaction.delete(cartLines).where(inArray(cartLines.id, cart.lines.map(line => line.id)));
      if (freeDelivery && !waitingForIdCheck) await transaction.insert(customerNotifications).values({
        idempotencyKey: `order.free-delivery:${order.id}`, orderId: order.id, customerId,
        type: "order.free-delivery", title: "Order confirmed · free delivery",
        body: `Order #${order.id} is confirmed with Free delivery. No quote is needed.`,
        link: `/profile/orders?order=${order.id}`,
      });
      if (order.status === "confirmed" && isPrepaid(order.paymentMethod)) {
        await transaction.insert(customerNotifications).values(paymentNeededNotification(order));
      }

      // Built from the Cart lines already in hand, not re-queried: `linesForOrder`
      // is bound to the outer `db`, and querying it from inside this still-open
      // transaction (PGlite has a single underlying connection) would deadlock.
      return {
        id: order.id,
        fulfillmentMethod: order.fulfillmentMethod as FulfillmentMethod,
        paymentMethod: order.paymentMethod as PaymentMethod,
        status: order.status as OrderStatus,
        subtotalInCentavos: order.subtotalInCentavos,
        deliveryFeeInCentavos: order.deliveryFeeInCentavos,
        createdAt: order.createdAt,
        deliveryAddress,
        paymentProof: null,
        paidById: null,
        paidByName: null,
        paidAt: null,
        deliveryPhotoFileId: null,
        deliveryPhotoRemovedAt: null,
        courier: null,
        lines: cart.lines.map(({ productName, imageUrl, sizeLabel, priceInCentavos, quantity }) => ({
          productName,
          imageUrl,
          sizeLabel,
          priceInCentavos,
          quantity,
        })),
      };
    });
    } catch (error) {
      await reservations.abandon(attemptId);
      await reservations.drain(new Date(), attemptId);
      throw error;
    }
  }

  return { place, listForCustomer, advance, cancel, cancelItems, customerEmailForOrder, customerIdForOrder, submitPaymentProof, getPaymentProofScreenshot, rejectPaymentProof };
}
