import { get } from "@vercel/blob";

import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

/** Streams a Message's private image to the Customer who owns its Ticket; the Blob URL is never exposed. */
export async function GET(_request: Request, context: RouteContext<"/api/support/attachments/[messageId]">) {
  const { messageId: messageIdParam } = await context.params;
  const messageId = positiveIntegerField("Message ID").safeParse(messageIdParam);
  if (!messageId.success) return new Response("Not found", { status: 404 });

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return new Response("Not found", { status: 404 });

  const pathname = await createTicketStore(getDatabase()).getAttachmentPathname(messageId.data, visitor.customer.userId);
  const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
  if (!pathname || !token) return new Response("Not found", { status: 404 });

  const blob = await get(pathname, { access: "private", token });
  if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
