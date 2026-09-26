import { VerifyEmailConfirmation } from "@/components/features/auth/verify-email-confirmation";
import { Card } from "@/components/ui/card";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center px-5 py-12 sm:px-8 sm:py-16">
      <Card className="mx-auto w-full max-w-xl p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Verify your email</h1>
        <VerifyEmailConfirmation token={typeof token === "string" ? token : undefined} />
      </Card>
    </section>
  );
}
