import { z } from "zod";

import { completeProfileSchema } from "./complete-profile-schema";
import { composeFullName } from "./sign-up-schema";
import type { CustomerStore } from "./sign-up";

export type CompleteProfileResult =
  | { status: "completed" }
  /** The Customer's details were already saved, so nothing was changed. */
  | { status: "already-complete" }
  | { status: "invalid"; fieldErrors: Record<string, string[] | undefined> };

/**
 * Saves the Customer details and first Address for a login that has neither.
 * The email comes from the login, so a submitted email is never trusted.
 */
export async function completeCustomerProfile(
  input: unknown,
  dependencies: {
    identity: { userId: string; email: string };
    customerStore: CustomerStore;
  },
): Promise<CompleteProfileResult> {
  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const details = parsed.data;
  const saved = await dependencies.customerStore.save({
    userId: dependencies.identity.userId,
    firstName: details.firstName,
    middleName: details.middleName || null,
    lastName: details.lastName,
    fullName: composeFullName(details),
    email: dependencies.identity.email.toLowerCase(),
    contactNumber: details.contactNumber,
    marketingOptIn: details.marketingOptIn === "yes",
    address: {
      street: details.street,
      barangay: details.barangay,
      city: details.city,
      province: details.province,
      postalCode: details.postalCode,
    },
  });

  return { status: saved ? "completed" : "already-complete" };
}
