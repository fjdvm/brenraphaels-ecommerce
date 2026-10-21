export type AuditIdentity = { type: string; id: string; display_name: string };

/** An Audit Event as audit-logs accepts it; only the fields the storefront writes. */
export type AuditEvent = {
  source: "Ecommerce";
  action: string;
  outcome: "success" | "failure";
  actor: AuditIdentity;
  subject?: AuditIdentity;
  target: AuditIdentity;
  description: string;
  occurred_at: string;
  idempotency_key?: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see .env.production.example`);
  return value;
}

/** Writes an Audit Event through the api-gateway, as the storefront's Caller. Callers decide whether a failure matters. */
export async function writeAuditEvent(event: AuditEvent, fetcher: typeof fetch = fetch): Promise<void> {
  const base = required("API_GATEWAY_URL").replace(/\/$/, "");
  const response = await fetcher(`${base}/audit/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The gateway refused the audit event: ${response.status}`);
}
