import { ArrowRight, ArrowUpRight, LogOut } from "lucide-react";
import Link from "next/link";

import { signOutApplicantAction } from "@/app/(careers)/careers/actions";
import { CareersHeaderShell } from "@/components/features/careers/careers-header-shell";
import { CareersLogo } from "@/components/features/careers/careers-logo";
import { CareersDrawerLinks, CareersNavLinks } from "@/components/features/careers/careers-nav-links";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountMenu } from "@/components/shared/account-menu";
import { NotificationBell } from "@/components/shared/notification-bell";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { careersSession } from "@/lib/careers/auth";
import { unreadApplicantInboxCount } from "@/lib/careers/inbox";

const headerClass =
  "flex items-center gap-x-3 mx-auto max-w-[1440px] whitespace-nowrap px-5 py-5 sm:px-10 lg:gap-x-6";
const brandClass = "flex min-w-0 items-center gap-4 lg:min-w-[360px]";
const sideClass =
  "ml-auto flex items-center justify-end gap-3 lg:min-w-[360px] lg:gap-5";
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
      <span aria-hidden className="h-8 w-px bg-line max-sm:hidden" />
      <Link
        href="/careers"
        className="font-serif text-[22px] leading-[1.3] text-primary max-sm:hidden"
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
        <div className={sideClass}>
          <Skeleton className="h-4 w-12 lg:w-20" />
          <Skeleton className="h-9 w-40 rounded-full max-lg:hidden" />
          <Skeleton className="size-10 rounded-full lg:hidden" />
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
      <CareersHeaderShell
        className={headerClass}
        brand={<Brand />}
        nav={
          <nav
            aria-label="Careers"
            className="hidden lg:flex lg:flex-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-x-9"
          >
            <CareersNavLinks />
          </nav>
        }
        actions={
          <div className={sideClass}>
            <span className="max-lg:hidden">{shopLink}</span>
            {applicant ? (
              <>
                <Button asChild variant="pill-outline" size="pill-sm" className="max-lg:hidden">
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
                <Button asChild variant="pill" size="pill-sm" className="max-lg:hidden">
                  <Link href="/careers/signup">Become an applicant</Link>
                </Button>
              </>
            )}
          </div>
        }
        drawer={
          <div className="flex flex-1 flex-col">
            <div className="px-5 pb-6 pr-20 pt-5">
              <CareersLogo />
            </div>
            <nav aria-label="Careers menu" className="flex-1 px-3">
              <CareersDrawerLinks />
            </nav>
            <div className="flex flex-col gap-3 border-t border-line p-5">
              {applicant ? (
                <Button asChild variant="pill" size="pill-lg" className="justify-center whitespace-nowrap px-6">
                  <Link href="/careers/applications">My applications</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="pill" size="pill-lg" className="justify-center whitespace-nowrap px-6">
                    <Link href="/careers/signup">
                      Become an applicant
                      <ArrowRight aria-hidden className="size-5" />
                    </Link>
                  </Button>
                  <Button asChild variant="pill-outline" size="pill-lg" className="justify-center whitespace-nowrap px-6">
                    <Link href="/careers/signin">Applicant sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      />
    </header>
  );
}
