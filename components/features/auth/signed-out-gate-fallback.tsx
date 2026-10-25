import { AuthCard } from "@/components/features/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the card, heading, and field shape of the sign-in form so nothing jumps once it resolves. */
export function SignedOutGateFallback() {
  return (
    <AuthCard aria-hidden="true">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-[77px] w-full" />
      <Skeleton className="h-[77px] w-full" />
      <Skeleton className="h-[59px] w-full rounded-full" />
    </AuthCard>
  );
}
