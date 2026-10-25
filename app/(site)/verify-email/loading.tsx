import {
  VerifyEmailFallback,
  VerifyEmailShell,
} from "@/components/features/auth/verify-email-shell";

export default function VerifyEmailLoading() {
  return (
    <VerifyEmailShell>
      <VerifyEmailFallback />
    </VerifyEmailShell>
  );
}
