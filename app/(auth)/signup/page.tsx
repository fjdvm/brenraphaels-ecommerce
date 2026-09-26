import type { Metadata } from "next";

import { SignUpForm } from "@/components/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16">
      <SignUpForm />
    </section>
  );
}
