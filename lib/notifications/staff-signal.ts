import { after } from "next/server";
import { postToGateway } from "../gateway";

type StaffSignalKind = "Customer" | "Payment" | "Ticket" | "Feedback" | "Return";

/** Call only after the event is saved. CREOMS owns alert contents and Module visibility. */
export function scheduleStaffSignal(kind: StaffSignalKind): void {
  try {
    after(async () => {
      try {
        await postToGateway("/creoms/notifications/signal", { kind }, `${kind} signal`);
      } catch (error) {
        console.error("Staff signal could not be sent", error);
      }
    });
  } catch (error) {
    console.error("Staff signal could not be scheduled", error);
  }
}
