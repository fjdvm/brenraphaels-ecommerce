/** Process liveness only: deliberately independent of Auth and databases. */
export function GET() {
  return Response.json({ status: "ok" });
}
