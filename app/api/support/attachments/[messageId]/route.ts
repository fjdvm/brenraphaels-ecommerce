import { get } from "@vercel/blob";

import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Shows a Message's private image to the Customer who owns its Ticket. An image in file-storage is
 * reached by sending the browser to its short-lived address; an older image in Vercel Blob is
 * streamed, so its Blob URL is never exposed.
 */
export async function GET(_request: Request, context: RouteContext<"/api/support/attachments/[messageId]">) {
  const { messageId: messageIdParam } = await context.params;
  const messageId = positiveIntegerField("Message ID").safeParse(messageIdParam);
  if (!messageId.success) return notFound();

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return notFound();

  const attachment = await createTicketStore(getDatabase()).getAttachment(messageId.data, visitor.customer.userId);
  if (!attachment) return notFound();

  if ("fileId" in attachment) {
    try {
      const url = await gatewayTicketFiles().viewUrl(attachment.fileId);

      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
    } catch (error) {
      console.error("A Ticket image could not be reached in file-storage", error);

      return notFound();
    }
  }

  const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
  if (!token) return notFound();

  const blob = await get(attachment.pathname, { access: "private", token });
  if (!blob || blob.statusCode !== 200) return notFound();

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
