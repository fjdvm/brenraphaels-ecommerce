import { redirect } from "next/navigation";

import { profilePath } from "@/lib/auth/route-access";

export default function ProfilePage() {
  redirect(profilePath);
}
