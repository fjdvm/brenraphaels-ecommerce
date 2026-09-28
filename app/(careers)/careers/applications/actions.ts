"use server";

import { revalidatePath } from "next/cache";

import { createApplicationStore, withdrawApplication } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { applicationReferenceNumberField } from "@/lib/validators/application";

export async function withdrawApplicationAction(formData: FormData) {
  const applicant = await careersSession();
  const referenceNumber = applicationReferenceNumberField.safeParse(formData.get("referenceNumber"));
  if (!applicant || !referenceNumber.success) return;
  try {
    await withdrawApplication(referenceNumber.data, createApplicationStore(getCareersDatabase()), applicant.userId);
  } catch {
    // The dashboard only offers Withdraw while the Application is still withdrawable; a status
    // change racing this submission is the only way this rejects, so just re-render the current state.
  } finally {
    revalidatePath("/careers/applications");
  }
}
