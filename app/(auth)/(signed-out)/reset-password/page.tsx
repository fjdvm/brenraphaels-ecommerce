import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : undefined} />;
}
