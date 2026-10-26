import { getDatabase } from "@/lib/db";
import { createDeliveryPhotoRetentionStore } from "@/lib/orders/delivery-photo-retention";

export const runtime = "nodejs";

/** Called by the daily GitHub Actions schedule with CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await createDeliveryPhotoRetentionStore(getDatabase()).removeDue(new Date());
  return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
}
