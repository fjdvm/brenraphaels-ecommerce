"use server";

import { redirect } from "next/navigation";

import { signOutApplicant } from "@/lib/careers/auth";

export async function signOutApplicantAction() {
  await signOutApplicant();
  redirect("/careers");
}
