import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { unsubscribeCustomer } from "@/lib/customer/unsubscribe";
import { unsubscribeSecret } from "@/lib/customer/unsubscribe-secret";
import { getDatabase } from "@/lib/db";

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

function UnsubscribeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-label="Unsubscribing">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  );
}

export default function UnsubscribePage(props: UnsubscribePageProps) {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center px-5 py-12 sm:px-8 sm:py-16">
      <Card className="mx-auto w-full max-w-xl p-8 text-center shadow-sm">
        <Suspense fallback={<UnsubscribeSkeleton />}>
          <UnsubscribeResult {...props} />
        </Suspense>
      </Card>
    </section>
  );
}
