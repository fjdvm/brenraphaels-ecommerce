import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { listCustomerReturns } from "@/lib/returns/customer-reads";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { positiveIntegerField } from "@/lib/validators/fields";

const notFound = () => new Response("Not found", { status: 404 });

/** Sends the Customer who owns a Refunded Return to its refund proof's short-lived address. */
export async function GET(_request: Request, context: RouteContext<"/api/returns/[id]/refund-proof">) {
  const { id: idParam } = await context.params;
  const id = positiveIntegerField("Return ID", { max: 2147483647 }).safeParse(idParam);
  if (!id.success) return notFound();

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return notFound();

  try {
    const returns = await listCustomerReturns(getDatabase(), visitor.customer.userId);
    const fileId = returns.find((entry) => entry.id === id.data)?.refundProofFileId;
    if (!fileId) return notFound();

    const url = await gatewayTicketFiles().viewUrl(fileId);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("A refund proof could not be reached in file-storage", error);
    return notFound();
  }
}
