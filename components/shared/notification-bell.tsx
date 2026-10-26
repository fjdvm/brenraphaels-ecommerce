import { Bell } from "lucide-react";
import Link from "next/link";

/** The Customer's bell: a link to the Notifications page, badged with how many are unread. */
export function NotificationBell({ className, size = 20, unread }: { className?: string; size?: number; unread: number }) {
  return (
    <Link
      href="/profile/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={className}
    >
      <span className="relative flex">
        <Bell size={size} />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
