import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderReceiptStore, OrderReceiptConflictError, OrderReceiptNotFoundError } from "@/lib/orders/receipt";
import { positiveIntegerField } from "@/lib/validators/fields";

export const runtime = "nodejs";

/** Irreversible Customer confirmation; service credentials grant no access. */
export async function POST(request: Request, context: RouteContext<"/api/orders/[id]/received">) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) {
    return Response.json({ error: "Invalid Order ID" }, { status: 400 });
  }
  if (await request.text() !== "") {
    return Response.json({ error: "This action requires an empty body." }, { status: 400 });
  }

  try {
    const result = await createOrderReceiptStore(getDatabase()).markReceived(visitor.customer.userId, orderId.data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof OrderReceiptNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OrderReceiptConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Order could not be marked received", error);
    return Response.json({ error: "Order could not be marked received. Try again." }, { status: 500 });
  }
}
