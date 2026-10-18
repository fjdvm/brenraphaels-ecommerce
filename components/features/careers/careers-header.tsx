import { ArrowUpRight, LogOut } from "lucide-react";
import Link from "next/link";

import { signOutApplicantAction } from "@/app/(careers)/careers/actions";
import { CareersLogo } from "@/components/features/careers/careers-logo";
import { CareersNavLinks } from "@/components/features/careers/careers-nav-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { careersSession } from "@/lib/careers/auth";

const headerClass =
  "flex flex-wrap items-center gap-x-6 gap-y-3 whitespace-nowrap border-b border-line bg-surface px-5 py-5 sm:px-10";
const brandClass = "flex items-center gap-4 lg:min-w-[360px]";
const sideClass = "ml-auto flex items-center justify-end gap-5 lg:min-w-[360px]";
const shopLink = (
  <Link href="/" className="flex shrink-0 items-center gap-1.5 text-xs tracking-[0.35px] text-muted hover:text-primary">
    Visit the shop
    <ArrowUpRight aria-hidden className="size-3.5" />
  </Link>
);

function Brand() {
  return (
    <div className={brandClass}>
      <CareersLogo />
      <span aria-hidden className="h-8 w-px bg-line" />
      <Link href="/careers" className="font-serif text-[22px] leading-[1.3] text-primary">
        Careers
      </Link>
    </div>
  );
}

/** Sized like the resolved header so the page doesn't shift once the Applicant session loads. */
export function CareersHeaderFallback() {
  return (
    <header className={headerClass} aria-hidden="true">
      <Brand />
      <div className={sideClass}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
    </header>
  );
}

function initials(fullName: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}

/** The Careers portal header: separate from the shop's, with no cart or customer menu. */
export async function CareersHeader() {
  const applicant = await careersSession();

  return (
    <header className={headerClass}>
      <Brand />
      <nav aria-label="Careers" className="order-last flex w-full flex-wrap items-center justify-center gap-x-9 gap-y-1 lg:order-none lg:w-auto lg:flex-1">
        <CareersNavLinks signedIn={Boolean(applicant)} />
      </nav>
      <div className={sideClass}>
        {shopLink}
        {applicant ? (
          <>
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white"
              >
                {initials(applicant.fullName, applicant.email)}
              </span>
              <span className="hidden text-[15px] tracking-[0.35px] text-ink sm:inline">
                {applicant.fullName.trim().split(/\s+/)[0] || applicant.email}
              </span>
            </span>
            <SignOutButton
              action={signOutApplicantAction}
              className="flex items-center text-ink hover:no-underline [&>svg]:size-5"
              icon={<LogOut aria-hidden />}
              iconOnly
            />
          </>
        ) : (
          <>
            <Button asChild variant="link" size="link-sm">
              <Link href="/careers/signin">Sign in</Link>
            </Button>
            <Button asChild variant="pill" size="pill-sm">
              <Link href="/careers/signup">Become an applicant</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
