import { Bell } from "lucide-react";
import Link from "next/link";

/** The bell: a link to the Notifications page (the Customer's by default), badged with how many are unread. */
export function NotificationBell({
  className,
  size = 20,
  unread,
  href = "/profile/notifications",
}: {
  className?: string;
  size?: number;
  unread: number;
  href?: string;
}) {
  return (
    <Link
      href={href}
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
