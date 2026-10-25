import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { listCustomerReturns } from "@/lib/returns/customer-reads";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") {
    return Response.json({ error: "Sign in as a Customer to continue." }, { status: 401, headers: noStore });
  }
  try {
    return Response.json({ returns: await listCustomerReturns(getDatabase(), visitor.customer.userId) }, { headers: noStore });
  } catch (error) {
    console.error("Customer Returns could not be read", error);
    return Response.json({ error: "We couldn't load your Returns. Please refresh and try again." }, { status: 500, headers: noStore });
  }
}
