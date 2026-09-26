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
    <Card className="mx-auto max-w-xl rounded-2xl p-8 text-center shadow-sm">
      <h1 className="font-serif text-4xl text-primary">Verify your email</h1>
      <VerifyEmailConfirmation token={typeof token === "string" ? token : undefined} />
    </Card>
  );
}
