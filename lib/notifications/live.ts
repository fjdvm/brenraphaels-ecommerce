/** What the notifications service pushes to a Customer's open pages; the browser refetches the inbox on any of them. */
export type NotificationsLiveEvent =
  | { type: "notification.created"; notification: { id: string } }
  | { type: "notifications.read"; ids: string[] };

export type NotificationsLiveConnection = { close(): void };

/**
 * The live Notifications boundary: opens the line and reports what arrives. `onClose` fires when the line drops,
 * so the caller can reconnect. Tests replace this with a fake; the real one is components/features/customer/live-notifications-socket.ts.
 */
export type ConnectNotificationsLive = (handlers: {
  onOpen(): void;
  onEvent(event: NotificationsLiveEvent): void;
  onClose(): void;
}) => NotificationsLiveConnection;
