import { after } from "next/server";
import { postToGateway } from "../gateway";

/** Schedule only after commit. Delivery failure must never fail a saved Order or Return change. */
export function scheduleOrdersChanged(): void {
  try {
    after(async () => {
      try {
        await postToGateway("/notifications/orders/changed", {}, "Staff Orders signal");
      } catch (error) {
        console.error("Staff Orders signal could not be sent", error);
      }
    });
  } catch (error) {
    console.error("Staff Orders signal could not be scheduled", error);
  }
}
