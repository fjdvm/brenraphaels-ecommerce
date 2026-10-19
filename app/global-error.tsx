"use client";

/** Last resort when the root layout itself fails; it replaces the layout, so it renders its own <html> and has no app styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.25rem", maxWidth: 560, margin: "0 auto" }}>
        <h1>Something went wrong</h1>
        <p>We couldn&apos;t load this page. Please try again.</p>
        <button type="button" onClick={reset} style={{ padding: "0.75rem 1.5rem", borderRadius: 999, border: 0, background: "#46206f", color: "#fff" }}>
          Try again
        </button>
        {error.digest && <p style={{ fontSize: 12, opacity: 0.6 }}>Error {error.digest}</p>}
      </body>
    </html>
  );
}
