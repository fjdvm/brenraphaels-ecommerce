import { listBarangays, listCities } from "@/lib/address/locations";

export const runtime = "nodejs";

// The location list only changes with a package update, so let browsers and
// the CDN keep answers for a long time.
const cacheControl = "public, max-age=86400, s-maxage=604800";

/**
 * The next dropdown's choices: the cities of `?province=`, or with `&city=` too,
 * the barangays of that city. The provinces themselves are sent with the page.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province") ?? "";
  const city = searchParams.get("city");
  const options = city === null ? listCities(province) : listBarangays(province, city);

  return Response.json({ options }, { headers: { "Cache-Control": cacheControl } });
}
