import type { Metadata } from "next";

import { SignUpForm } from "@/components/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <SignUpForm />;
}
