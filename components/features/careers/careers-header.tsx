import { ArrowUpRight, LogOut } from "lucide-react";
import Link from "next/link";

import { signOutApplicantAction } from "@/app/(careers)/careers/actions";
import { CareersHeaderShell } from "@/components/features/careers/careers-header-shell";
import { CareersLogo } from "@/components/features/careers/careers-logo";
import { CareersNavLinks } from "@/components/features/careers/careers-nav-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountMenu } from "@/components/shared/account-menu";
import { NotificationBell } from "@/components/shared/notification-bell";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { careersSession } from "@/lib/careers/auth";
import { unreadApplicantInboxCount } from "@/lib/careers/inbox";
import { cn } from "@/lib/utils";

const headerClass =
  "flex flex-wrap items-center gap-x-6 gap-y-3 mx-auto max-w-[1440px] whitespace-nowrap px-5 py-5 sm:px-10";
const brandClass = "flex items-center gap-4 lg:min-w-[360px]";
const sideClass =
  "flex flex-col items-stretch gap-3 lg:ml-auto lg:min-w-[360px] lg:flex-row lg:items-center lg:justify-end lg:gap-5";
const shopLink = (
  <Link
    href="/"
    target="_blank"
    rel="noopener noreferrer"
    className="flex shrink-0 items-center gap-1.5 text-xs tracking-[0.35px] text-muted hover:text-primary"
  >
    Visit the shop
    <ArrowUpRight aria-hidden className="size-3.5" />
  </Link>
);

function Brand() {
  return (
    <div className={brandClass}>
      <CareersLogo />
      <span aria-hidden className="h-8 w-px bg-line" />
      <Link
        href="/careers"
        className="font-serif text-[22px] leading-[1.3] text-primary"
      >
        Careers
      </Link>
    </div>
  );
}

/** Sized like the resolved header so the page doesn't shift once the Applicant session loads. */
export function CareersHeaderFallback() {
  return (
    <header className="border-b border-line bg-surface" aria-hidden="true">
      <div className={headerClass}>
        <Brand />
        <Skeleton className="size-10 rounded-full lg:hidden" />
        <div className={cn(sideClass, "max-lg:hidden")}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      </div>
    </header>
  );
}

/** The inbox being unreachable must not take the header down, so the bell then shows no count. */
async function unreadNotifications(): Promise<number> {
  try {
    return await unreadApplicantInboxCount();
  } catch (error) {
    console.error("Unread Applicant Notifications could not be counted", error);
    return 0;
  }
}

function initials(fullName: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}

/** The Careers portal header: separate from the shop's, with no cart or customer menu. */
export async function CareersHeader() {
  const applicant = await careersSession();
  const unread = applicant ? await unreadNotifications() : 0;

  return (
    <header className="border-b border-line bg-surface">
      <CareersHeaderShell className={headerClass} brand={<Brand />}>
        <nav
          aria-label="Careers"
          className="order-last flex w-full flex-col items-stretch gap-1 lg:order-none lg:w-auto lg:flex-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-x-9"
        >
          <CareersNavLinks />
        </nav>
        <div className={sideClass}>
          {shopLink}
          {applicant ? (
            <>
              <Button asChild variant="pill-outline" size="pill-sm">
                <Link href="/careers/applications">My applications</Link>
              </Button>
              <NotificationBell href="/careers/notifications" className="relative flex p-2 text-ink hover:text-primary" size={22} unread={unread} />
              <AccountMenu
                menu="careers"
                initials={initials(applicant.fullName, applicant.email)}
                firstName={applicant.fullName.trim().split(/\s+/)[0] || applicant.email}
                signOut={
                  <SignOutButton
                    action={signOutApplicantAction}
                    className="flex w-full items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low hover:no-underline [&>svg]:size-[18px]"
                    icon={<LogOut aria-hidden />}
                  />
                }
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
      </CareersHeaderShell>
    </header>
  );
}
