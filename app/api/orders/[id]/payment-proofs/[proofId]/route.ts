import { get } from "@vercel/blob";

import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { positiveIntegerField } from "@/lib/validators/fields";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404 });
const headers = (contentType: string) => ({ "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });

/**
 * Shows one payment-proof screenshot of an Order to its owning Customer. The bytes are streamed (not redirected)
 * so the page's in-browser reader can fetch the image from the same origin.
 */
export async function GET(_request: Request, context: RouteContext<"/api/orders/[id]/payment-proofs/[proofId]">) {
  const { id, proofId } = await context.params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  const proof = positiveIntegerField("Proof ID").safeParse(proofId);
  if (!orderId.success || !proof.success) return notFound();

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return notFound();

  const screenshot = await createOrderStore(getDatabase()).getPaymentProofScreenshotById(visitor.customer.userId, orderId.data, proof.data);
  if (!screenshot) return notFound();

  try {
    if ("fileId" in screenshot) {
      const url = await gatewayTicketFiles().viewUrl(screenshot.fileId);
      const upstream = await fetch(url, { cache: "no-store" });
      if (!upstream.ok || !upstream.body) return notFound();

      return new Response(upstream.body, { headers: headers(upstream.headers.get("content-type") ?? "image/jpeg") });
    }

    const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
    if (!token) return notFound();
    const blob = await get(screenshot.pathname, { access: "private", token });
    if (!blob || blob.statusCode !== 200) return notFound();

    return new Response(blob.stream, { headers: headers(blob.blob.contentType) });
  } catch (error) {
    console.error("A payment-proof screenshot could not be reached", error);

    return notFound();
  }
}
