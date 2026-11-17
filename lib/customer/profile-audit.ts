import { writeAuditEvent, type AuditEvent } from "../audit/gateway";

/** Names of the keys whose value differs. Only names are ever returned, never values. */
export function changedFieldNames<T extends Record<string, unknown>>(
  before: Partial<T>,
  after: T,
): string[] {
  return (Object.keys(after) as (keyof T & string)[]).filter(
    (key) => (before[key] ?? null) !== (after[key] ?? null),
  );
}

/**
 * Records one "profile updated" Audit Event listing the names of the fields
 * that changed, never their values. Nothing is recorded when nothing changed.
 * A failure never fails the update.
 */
export async function recordProfileUpdated(
  fields: string[],
  dependencies: {
    userId: string;
    audit?: (event: AuditEvent) => Promise<void>;
  },
) {
  if (fields.length === 0 || !dependencies.audit) return;
  const customer = { type: "customer", id: dependencies.userId, display_name: "Customer" };
  try {
    await dependencies.audit({
      source: "Ecommerce",
      action: "profile_updated",
      outcome: "success",
      actor: customer,
      subject: customer,
      target: customer,
      description: `Profile updated: ${fields.join(", ")}`,
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Profile updated audit event failed", error);
  }
}

export const auditProfileEvent = (event: AuditEvent) => writeAuditEvent(event);
