import { Suspense } from "react";

import { unsubscribeCustomer } from "@/lib/customer/unsubscribe";
import { unsubscribeSecret } from "@/lib/customer/unsubscribe-secret";
import { getDatabase } from "@/lib/db";

import { UnsubscribeCard, UnsubscribeSkeleton } from "./unsubscribe-skeleton";

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export const metadata = { robots: { index: false } };

async function UnsubscribeResult({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams;
  const result = await unsubscribeCustomer(typeof token === "string" ? token : undefined, {
    secret: unsubscribeSecret(),
    db: getDatabase(),
  });

  if (result === "invalid") {
    return (
      <>
        <h1 className="font-serif text-4xl text-primary">This link doesn&apos;t work</h1>
        <p className="mt-4 text-muted-foreground">
          This unsubscribe link is invalid or incomplete, so nothing was changed. Please use the
          link in the footer of the latest email we sent you, or contact us and we&apos;ll help.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-serif text-4xl text-primary">You&apos;re unsubscribed</h1>
      <p className="mt-4 text-muted-foreground">
        You will no longer receive promotional emails from us. You&apos;ll still get emails about
        your orders and your account.
      </p>
    </>
  );
}

export default function UnsubscribePage(props: UnsubscribePageProps) {
  return (
    <UnsubscribeCard>
      <Suspense fallback={<UnsubscribeSkeleton />}>
        <UnsubscribeResult {...props} />
      </Suspense>
    </UnsubscribeCard>
  );
}
