import type { InboxNotification } from "./inbox";

export type NotificationIcon = "support" | "payment" | "confirmed" | "delivery" | "order";
export type NotificationCategory = "orders" | "support";

/** Types are `<subject>.<event>`; the subject decides where the Notification is filed and how it looks. */
export function categoryOf({ type }: Pick<InboxNotification, "type">): NotificationCategory {
  return type.startsWith("ticket.") ? "support" : "orders";
}

export function iconOf({ type }: Pick<InboxNotification, "type">): NotificationIcon {
  if (type.startsWith("ticket.")) return "support";
  if (type.startsWith("payment.")) return "payment";
  if (type === "order.delivered" || type.startsWith("feedback.")) return "confirmed";
  if (type === "order.dispatched" || type.startsWith("delivery.")) return "delivery";
  return "order";
}

/** A link into this storefront opens as a client navigation; anything else is left as the sender wrote it. */
export function linkTarget(link: string, siteUrl: string | undefined): string {
  try {
    const target = new URL(link);
    if (siteUrl && target.origin === new URL(siteUrl).origin) return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    // Not an absolute address: a path is already local.
  }
  return link;
}
