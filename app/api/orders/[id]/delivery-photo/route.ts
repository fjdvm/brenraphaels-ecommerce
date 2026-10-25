import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createDeliveryPhotoReader } from "@/lib/orders/delivery-photo";
import { positiveIntegerField } from "@/lib/validators/fields";

export const runtime = "nodejs";

/** Only the owning Customer is sent to the photo; the signed address is never stored. */
export async function GET(_request: Request, context: RouteContext<"/api/orders/[id]/delivery-photo">) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) {
    return Response.json({ error: "Invalid Order ID" }, { status: 400 });
  }
  try {
    const url = await createDeliveryPhotoReader(getDatabase())(visitor.customer.userId, orderId.data);
    if (!url) return Response.json({ error: "No photo" }, { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Delivery photo could not be loaded", error);
    return Response.json({ error: "Delivery photo could not be loaded." }, { status: 502 });
  }
}
