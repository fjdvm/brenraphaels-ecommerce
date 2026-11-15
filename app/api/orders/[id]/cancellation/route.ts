import { and, eq } from "drizzle-orm";
import { orders, orderCancellations } from "@/lib/db/schema";
import { after } from "next/server";
import { ZodError } from "zod";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderCancellations, CancellationError } from "@/lib/orders/cancellations";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { createStockReservations } from "@/lib/orders/stock-reservations";

export async function POST(request: Request, context: RouteContext<"/api/orders/[id]/cancellation">) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in as a Customer to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order number." }, { status: 400 });
  try {
    const result = await createOrderCancellations(getDatabase()).request(id, await request.json(), {
      type: "customer", id: visitor.customer.userId, name: visitor.customer.fullName,
    });
    scheduleStaffSignal("Return");
    after(() => createStockReservations(getDatabase()).sendPending());
    return Response.json(result, { status: 202 });
  } catch (e) {
    if (e instanceof ZodError) return Response.json({ error: e.issues[0].message }, { status: 400 });
    if (e instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
    if (e instanceof CancellationError) return Response.json({ error: e.message }, { status: 409 });
    return Response.json({ error: "Cancellation request could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}

export async function GET(_request: Request, context: RouteContext<"/api/orders/[id]/cancellation">) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in as a Customer to continue." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order number." }, { status: 400 });
  const [row] = await getDatabase().select({ requestId: orderCancellations.id, state: orderCancellations.status, approval: orderCancellations.approvalStatus, declineReason: orderCancellations.declineReason })
    .from(orderCancellations).innerJoin(orders, eq(orders.id, orderCancellations.orderId)).where(and(eq(orders.id, id), eq(orders.customerId, visitor.customer.userId)));
  if (!row) return Response.json({ error: "Cancellation request was not found." }, { status: 404 });
  return Response.json({ requestId: row.requestId, status: row.state === "waiting-manager" ? row.approval : row.state, declineReason: row.declineReason });
}
