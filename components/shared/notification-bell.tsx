import { Bell } from "lucide-react";
import Link from "next/link";

import { CountBadge } from "@/components/shared/count-badge";

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
        <CountBadge count={unread} />
      </span>
    </Link>
  );
}
