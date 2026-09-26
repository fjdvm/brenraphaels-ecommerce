"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { confirmVerificationEmail } from "@/app/(site)/verify-email/actions";

import { ResendVerificationForm } from "./resend-verification-form";

export function VerifyEmailConfirmation({ token }: { token?: string }) {
  const router = useRouter();
  const didConfirm = useRef(false);
  const [result, setResult] = useState<"loading" | "expired" | "invalid">(
    "loading",
  );

  useEffect(() => {
    if (didConfirm.current) {
      return;
    }
    didConfirm.current = true;

    void confirmVerificationEmail(token).then((verificationResult) => {
      if (verificationResult === "verified") {
        router.replace("/profile");
        return;
      }
      setResult(verificationResult);
    });
  }, [router, token]);

  if (result === "loading") {
    return <p className="mt-4 text-on-surface-variant">Verifying your email…</p>;
  }

  const message =
    result === "expired"
      ? "This verification link has expired. Request a new email below."
      : "This verification link is invalid or has already been used. Request a new email below.";

  return (
    <>
      <p className="mt-4 text-on-surface-variant">{message}</p>
      <ResendVerificationForm />
    </>
  );
}
