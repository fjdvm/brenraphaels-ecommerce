import { listBarangays, listCities, listProvinces, listRegions, type PsgcOption } from "@/lib/psgc";

export const runtime = "nodejs";

// The PSGC list ships with the app, so browsers and the CDN can keep answers for a long time.
const cacheControl = "public, max-age=86400, s-maxage=604800";

/**
 * Options for the checkout address picker. `level` is the list wanted; `region`, `province` and `city`
 * are the codes chosen above it.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const level = q.get("level");
  const region = q.get("region") ?? "";
  let options: PsgcOption[];
  if (level === "region") options = listRegions();
  else if (level === "province") options = listProvinces(region);
  else if (level === "city") options = listCities(region, q.get("province") ?? "");
  else if (level === "barangay") options = await listBarangays(region, q.get("city") ?? "");
  else return Response.json({ message: "Choose a list to load." }, { status: 400 });
  return Response.json({ options }, { headers: { "Cache-Control": cacheControl } });
}
