"use server";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { requestCustomerPasswordReset } from "@/lib/customer/password-reset";
import { neonPasswordResetAuth } from "@/lib/neon-auth/server";

export type PasswordResetEmailState = {
  sent?: boolean;
};

/** Emails the signed-in Customer a link to choose a new password. */
export async function requestPasswordResetEmail(
  _previousState: PasswordResetEmailState,
): Promise<PasswordResetEmailState> {
  void _previousState;
  const customer = await requireCustomer();
  await requestCustomerPasswordReset(customer.email, { auth: neonPasswordResetAuth });
  return { sent: true };
}
