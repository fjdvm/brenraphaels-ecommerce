import { createGatewayInbox } from "./gateway-inbox";

export type { InboxNotification } from "./gateway-inbox";

/** The storefront inbox; recipient ids are Customer Neon Auth user ids. */
export const { listInbox, unreadInboxCount, markInboxRead, markAllInboxRead, liveInboxUrl } = createGatewayInbox("ecommerce");
