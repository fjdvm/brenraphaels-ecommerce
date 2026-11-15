import { after } from "next/server";
import { ZodError } from "zod";
import { getDatabase } from "@/lib/db";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createOrderCancellations, CancellationError, staffCancellationRequestInput, cancellationSettlementInput } from "@/lib/orders/cancellations";
import { verifyRefundProof, InvalidRefundProof } from "@/lib/returns/refund-proof";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { createOrderStore } from "@/lib/orders/orders";

export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/cancellation">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order number." }, { status: 400 });
  try {
    const raw = await request.json(), service = createOrderCancellations(getDatabase());
    let result;
    if (raw?.action === "request") {
      const input = staffCancellationRequestInput.parse(raw);
      result = await service.request(id, { reason: input.reason }, { type: "staff", id: input.staffId, name: input.staffName });
      scheduleStaffSignal("Return");
    } else {
      const input = cancellationSettlementInput.parse(raw);
      if (input.refundProofFileId) await verifyRefundProof(input.refundProofFileId, id, fetch, { entityType: "order", role: "cancellation-refund-proof" });
      result = await service.settle(id, input);
    }
    scheduleOrdersChanged();
    after(async () => {
      await publishAfterCommit(createOrderStore(getDatabase()).customerIdForOrder(id), { type: "order.updated", orderId: String(id) }, publishCustomerOrderEvent);
      await createStockReservations(getDatabase()).sendPending();
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof ZodError) return Response.json({ error: e.issues[0].message }, { status: 400 });
    if (e instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
    if (e instanceof InvalidRefundProof) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof CancellationError) return Response.json({ error: e.message }, { status: 409 });
    return Response.json({ error: "Cancellation could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
