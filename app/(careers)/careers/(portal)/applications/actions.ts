"use server";

import { revalidatePath } from "next/cache";

import { createApplicationStore, withdrawApplication } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { applicationReferenceNumberField } from "@/lib/validators/application";

export type WithdrawOutcome = { ok: true } | { ok: false; message: string };

/** Withdraws the signed-in Applicant's Application; says why when it could not, so the card can offer Retry. */
export async function withdrawApplicationAction(formData: FormData): Promise<WithdrawOutcome> {
  const applicant = await careersSession();
  if (!applicant) return { ok: false, message: "Please sign in to withdraw an application." };
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!referenceNumber.success) return { ok: false, message: "Choose a valid Application to withdraw." };
  try {
    await withdrawApplication(referenceNumber.data, createApplicationStore(getCareersDatabase()), applicant.userId);
    return { ok: true };
  } catch (error) {
    console.error("Application could not be withdrawn", error);
    return { ok: false, message: "We couldn't withdraw your application. It may have already moved on." };
  } finally {
    revalidatePath("/careers/applications");
  }
}
