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
  await withdrawApplication(referenceNumber.data, createApplicationStore(getCareersDatabase()), applicant.userId);
  revalidatePath("/careers/applications");
}
