"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { remainingMs, transitionTarget } from "@/lib/site/page-transition";

/** Gives up if the next page never arrives, so a failed navigation can't leave the screen up. */
const GIVE_UP_MS = 10_000;

/**
 * A blurred loading screen with the animated logo. It comes up when a visitor
 * follows a link to another page and stays for at least TRANSITION_MS after
 * that, even if the page is ready sooner.
 */
export function PageTransition() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const pending = useRef<{ path: string; startedAt: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const path = transitionTarget(
        { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") },
        window.location.href,
        event,
      );
      if (!path) return;
      clearTimeout(timer.current);
      pending.current = { path, startedAt: Date.now() };
      setVisible(true);
      timer.current = setTimeout(() => {
        pending.current = null;
        setVisible(false);
      }, GIVE_UP_MS);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const current = pending.current;
    if (!current || current.path !== pathname) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      setVisible(false);
    }, remainingMs(current.startedAt, Date.now()));
  }, [pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      aria-hidden={!visible}
      className={`fixed inset-0 z-[100] grid place-items-center bg-surface/60 backdrop-blur-xl transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {visible && (
        <div className="flex flex-col items-center gap-6">
          <div className="relative grid size-32 place-items-center">
            <span aria-hidden className="loading-ring absolute inset-0 rounded-full" />
            <Image
              src="/logo.jpeg"
              alt=""
              width={96}
              height={96}
              priority
              className="loading-logo size-24 rounded-[26px] object-cover shadow-lg"
            />
          </div>
          <p className="loading-text text-center">
            <strong className="block font-serif text-2xl leading-tight text-primary">
              Bren Raphael&apos;s
            </strong>
            <span className="mt-1 block text-xs font-medium uppercase tracking-[0.18em] text-on-surface-variant/70">
              Ube Jam &amp; Halaya
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
