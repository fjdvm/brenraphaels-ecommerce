import { redirect } from "next/navigation";

import { profilePath } from "@/lib/auth/route-access";

export default function NewsletterPage() {
  redirect(profilePath);
}
