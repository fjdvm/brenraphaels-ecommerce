import { parseApplicationDeliveryEvent, verifyInternalHrAtsApiKey } from "@/lib/careers/hr-ats-delivery";

export const runtime = "nodejs";

/**
 * Stand-in for HR-ATS's own receiving endpoint (ADR-0005, mirroring ADR-0003's
 * CREOMS placeholder) until the real HR-ATS API exists. Adopts the Application's
 * Reference number as the record's own identifier, exactly as the real HR-ATS
 * would.
 */
export async function PUT(
  request: Request,
  context: RouteContext<"/api/internal/hr-ats/applications/[referenceNumber]">,
) {
  const { referenceNumber } = await context.params;

  try {
    verifyInternalHrAtsApiKey(request.headers);
    const event = parseApplicationDeliveryEvent(await request.json());
    if (event.referenceNumber !== referenceNumber) throw new Error("Reference number mismatch");
    console.info("HR-ATS stand-in received an Application delivery", { referenceNumber, type: event.type });
    return Response.json({ id: referenceNumber });
  } catch {
    return Response.json({ error: "Invalid HR-ATS delivery request" }, { status: 400 });
  }
}
