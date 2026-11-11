"use client";

import { usePathname } from "next/navigation";

/** The mobile brand panel's eyebrow and headline: sign in welcomes back, every other screen shows the pitch. */
export function CareersAuthMobileHeading() {
  const signIn = usePathname() === "/careers/signin";
  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <p className="text-xs font-medium uppercase leading-normal tracking-[0.12em] text-accent">
        {signIn ? "Bren Raphael’s Careers" : "Careers portal"}
      </p>
      <p className="font-serif text-[28px] leading-[1.25]">{signIn ? "Welcome back." : "Grow with our small-batch kitchen."}</p>
    </div>
  );
}
