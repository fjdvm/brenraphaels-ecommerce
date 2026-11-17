"use server";

import { redirect } from "next/navigation";

import { auditProfileEvent } from "@/lib/customer/profile-audit";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { deleteAccount } from "@/lib/customer/delete-account";
import { DeletionRefusedError, type DeletionBlocker } from "@/lib/customer/deletion";
import { getDatabase } from "@/lib/db";
import { signOutVisitor } from "@/lib/neon-auth/server";

export type DeleteAccountState = {
  blockers?: DeletionBlocker[];
  error?: string;
};

/**
 * Deletes the signed-in Customer's account, then signs them out and sends them home.
 * Refused while an Order, Return or Ticket is in flight: the blockers come back to be listed.
 */
export async function requestAccountDeletion(): Promise<DeleteAccountState> {
  const customer = await requireCustomer();
  try {
    await deleteAccount(customer.userId, { db: getDatabase(), audit: auditProfileEvent });
  } catch (error) {
    if (error instanceof DeletionRefusedError) return { blockers: error.blockers };
    console.error("Account deletion failed", error);
    return { error: "We couldn't delete your account. Please try again." };
  }
  await signOutVisitor();
  redirect("/");
}
