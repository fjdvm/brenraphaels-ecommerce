import Link from "next/link";
import { Suspense } from "react";
import { verifyApplicantEmail } from "@/lib/careers/auth";
import { emailedTokenField } from "@/lib/validators/careers";
import { BackLink } from "../_components/back-link";
import { CareersFormSkeleton } from "../_components/skeletons";

async function VerifyApplicantEmailPageContent({ searchParams }: PageProps<"/careers/verify-email">) {
  const { token } = await searchParams;
  const parsedToken = emailedTokenField.safeParse(token);
  const result = parsedToken.success ? await verifyApplicantEmail(parsedToken.data) : "invalid";
  return <section className="mx-auto max-w-md py-16"><BackLink href="/careers" className="text-sm underline">Back</BackLink><h1 className="mt-8 font-serif text-4xl text-primary">{result === "verified" ? "Email verified" : "Verification link not valid"}</h1><p className="mt-4 text-on-surface-variant">{result === "verified" ? "Your Applicant email is verified. You can now sign in." : "This link has expired or was already used. Please sign in to request another email."}</p><Link className="mt-6 inline-block font-semibold text-primary underline" href="/careers/signin">Go to Applicant sign in</Link></section>;
}

export default function VerifyApplicantEmailPage(props: PageProps<"/careers/verify-email">) {
  return (
    <Suspense fallback={<CareersFormSkeleton />}>
      <VerifyApplicantEmailPageContent {...props} />
    </Suspense>
  );
}
