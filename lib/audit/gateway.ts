import { postToGateway } from "../gateway";

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

/** Writes an Audit Event through the api-gateway, as the storefront's Caller. Callers decide whether a failure matters. */
export function writeAuditEvent(event: AuditEvent, fetcher: typeof fetch = fetch): Promise<void> {
  return postToGateway("/audit/events", event, "audit event", fetcher);
}
