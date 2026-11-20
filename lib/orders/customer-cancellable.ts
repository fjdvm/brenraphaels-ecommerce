/** The statuses a Customer may cancel from themselves: before payment and before the shop starts preparing. Client-safe. */
export const CUSTOMER_CANCELLABLE: readonly string[] = ["placed", "confirmed", "awaiting payment"];
