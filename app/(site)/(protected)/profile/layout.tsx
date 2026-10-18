import type { ReactNode } from "react";

/** Each account page draws its own heading; the sidebar comes from the site layout. */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
