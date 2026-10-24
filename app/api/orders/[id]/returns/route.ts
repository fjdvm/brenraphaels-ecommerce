import { handleCustomerReturn } from "@/lib/returns/customer-api";

export async function POST(request: Request, context: RouteContext<"/api/orders/[id]/returns">) {
  const { id } = await context.params;
  return handleCustomerReturn(request, id, "request");
}
