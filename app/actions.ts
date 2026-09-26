"use server";

import { redirect } from "next/navigation";

import { signOutVisitor } from "@/lib/neon-auth/server";

export async function signOut() {
  await signOutVisitor();
  redirect("/");
}
