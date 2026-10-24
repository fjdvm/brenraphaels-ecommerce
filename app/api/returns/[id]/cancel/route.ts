import { handleCustomerReturn } from "@/lib/returns/customer-api";

export async function POST(request: Request, context: RouteContext<"/api/returns/[id]/cancel">) {
  const { id } = await context.params;
  return handleCustomerReturn(request, id, "cancel");
}
