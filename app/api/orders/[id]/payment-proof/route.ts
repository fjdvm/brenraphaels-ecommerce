import { get } from "@vercel/blob";

import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";
import { processPaymentProof } from "@/lib/orders/process-payment-proof";
import { isSameOrigin } from "@/lib/security/same-origin";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { positiveIntegerField } from "@/lib/validators/fields";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Shows an Order's payment-proof screenshot to its owning Customer. A File in file-storage is reached
 * by sending the browser to its short-lived address; an older screenshot in Vercel Blob is streamed,
 * so its Blob URL is never exposed.
 */
export async function GET(_request: Request, context: RouteContext<"/api/orders/[id]/payment-proof">) {
  const { id } = await context.params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) return notFound();

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return notFound();

  const screenshot = await createOrderStore(getDatabase()).getPaymentProofScreenshot(visitor.customer.userId, orderId.data);
  if (!screenshot) return notFound();

  if ("fileId" in screenshot) {
    try {
      const url = await gatewayTicketFiles().viewUrl(screenshot.fileId);

      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
    } catch (error) {
      console.error("A payment-proof screenshot could not be reached in file-storage", error);

      return notFound();
    }
  }

  const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
  if (!token) return notFound();

  try {
    const blob = await get(screenshot.pathname, { access: "private", token });
    if (!blob || blob.statusCode !== 200) return notFound();

    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("A legacy payment-proof screenshot could not be read from Vercel Blob", error);

    return notFound();
  }
}

/**
 * Saves a payment proof sent by the browser with upload progress. Does what the Form Action does and
 * answers with the same state, so the form shows the same messages either way.
 */
export async function POST(request: Request, context: RouteContext<"/api/orders/[id]/payment-proof">) {
  const { id } = await context.params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) return notFound();

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ message: "Sign in to submit your payment proof." }, { status: 401 });

  if (!isSameOrigin(request)) return Response.json({ message: "We couldn't submit your payment proof." }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "We couldn't read that upload. Please try again." }, { status: 400 });
  }
  return Response.json(await processPaymentProof(orderId.data, formData), { headers: { "Cache-Control": "private, no-store" } });
}
