import type { Metadata } from "next";

import { SignInForm } from "@/components/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type SignInPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : undefined} />;
}
