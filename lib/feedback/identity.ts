import { careersSession } from "@/lib/careers/auth";
import { getVisitorSession } from "@/lib/neon-auth/server";

/** Storefront wins when both path-scoped sessions are present. Never expose email. */
export async function resolveFeedbackIdentity() {
  try {
    const storefront = await getVisitorSession();
    if (storefront) return storefront.userId;
  } catch {
    // An unavailable storefront auth service must not prevent reporting feedback.
  }

  try {
    const applicant = await careersSession();
    if (applicant) return applicant.userId;
  } catch {
    // An unavailable careers auth service must not prevent reporting feedback.
  }

  return "anonymous";
}
