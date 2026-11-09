"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  "response-field": false;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widget: string) => void;
    };
  }
}

/** Explicit rendering supports client navigation and renews single-use tokens after a submit. */
export function TurnstileWidget({ resetKey }: { resetKey: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLParagraphElement>(null);
  const [ready, setReady] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!ready || !sitekey || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const clear = () => { if (token.current) token.current.value = ""; };
    clear();
    if (message.current) message.current.textContent = "";
    const widget = api.render(container.current, {
      sitekey,
      "response-field": false,
      callback: (value) => {
        if (token.current) token.current.value = value;
        if (message.current) message.current.textContent = "";
      },
      "expired-callback": clear,
      "error-callback": () => {
        clear();
        if (message.current) message.current.textContent = "The security check could not load. Please retry or reload this page.";
      },
    });
    return () => { api.remove(widget); clear(); };
  }, [ready, resetKey, sitekey]);

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => {
          if (message.current) message.current.textContent = "The security check could not load. Please reload this page.";
        }}
      />
      <div ref={container} aria-label="Security check" />
      <input ref={token} type="hidden" name="cf-turnstile-response" defaultValue="" />
      <p ref={message} role="alert" className="text-sm text-red-700">
        {sitekey ? "" : "The security check is unavailable. Please try again later."}
      </p>
    </div>
  );
}
