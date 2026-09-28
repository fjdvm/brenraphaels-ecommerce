import { getDatabase } from "@/lib/db";
import { verifyInternalOrderStatusUpdate } from "@/lib/orders/internal-status";
import { createOrderStore } from "@/lib/orders/orders";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/internal/orders/[id]/status">,
) {
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return Response.json({ error: "Invalid Order status request" }, { status: 400 });
  }

  try {
    const update = verifyInternalOrderStatusUpdate(await request.json(), request.headers);
    const order = await createOrderStore(getDatabase()).advance(orderId, update);
    return Response.json(order);
  } catch {
    return Response.json({ error: "Invalid Order status request" }, { status: 400 });
  }
}
