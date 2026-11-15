export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see .env.production.example`);
  return value;
}

/** POSTs JSON to the api-gateway as the storefront's Caller; throws "The gateway refused the <what>: <status>" on failure. */
export async function postToGateway(path: string, body: unknown, what: string, fetcher: typeof fetch = fetch, idempotencyKey?: string): Promise<void> {
  const base = required("API_GATEWAY_URL").replace(/\/$/, "");
  const response = await fetcher(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify(body),
    // A hung gateway must not hold up the caller.
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The gateway refused the ${what}: ${response.status}`);
}
