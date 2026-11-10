import { scheduleOrdersChanged } from "../orders/staff-signal";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scheduleStaffSignal } from "../notifications/staff-signal";
import { currentVisitor } from "../customer/current-visitor";
import { getDatabase } from "../db";
import { positiveIntegerField } from "../validators/fields";
import { createCustomerReturns } from "./customer-returns";
import { gatewayReturnEvidence } from "./evidence-files";
import { notifyReturnChange } from "./return-notices";
import { ReturnRequestError } from "./return-input";
import { ReturnTransitionError } from "./returns";

export async function handleCustomerReturn(request: Request, idParam: string, action: "request" | "upload" | "cancel") {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in as a Customer to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const id = positiveIntegerField(action === "cancel" ? "Return ID" : "Order ID", { max: 2147483647 }).safeParse(idParam);
  if (!id.success) return Response.json({ error: "Enter a valid id." }, { status: 400 });

  try {
    let input: unknown;
    if (action === "cancel") {
      const body = await request.text();
      if (body.trim()) z.object({}).strict().parse(JSON.parse(body));
    } else {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
        return Response.json({ error: "Send a JSON request." }, { status: 400 });
      }
      input = await request.json();
    }
    const service = createCustomerReturns(getDatabase(), { files: gatewayReturnEvidence() });
    const customerId = visitor.customer.userId;
    if (action === "upload") return Response.json(await service.prepareUpload(customerId, id.data, input), { status: 201 });
    const result = action === "cancel" ? await service.cancel(customerId, id.data) : await service.request(customerId, id.data, input);
    scheduleOrdersChanged();
    if (action === "request") {
      scheduleStaffSignal("Return");
      await notifyReturnChange(getDatabase(), result);
    }
    revalidatePath("/profile/orders");
    return Response.json({ id: result.id, status: result.status,
      ...(action === "request" ? { number: result.number } : {}) }, { status: action === "request" ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Send valid JSON." }, { status: 400 });
    if (error instanceof ReturnRequestError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ReturnTransitionError) return Response.json({ error: error.message }, { status: error.message === "Return not found." ? 404 : 409 });
    console.error("Customer Return failed", error);
    return Response.json({ error: "We couldn't complete this Return request. Please refresh and try again." }, { status: 500 });
  }
}
