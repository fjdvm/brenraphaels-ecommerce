import { Sparkles } from "lucide-react";

import type { TicketAssistantSummary } from "@/lib/assistant-handoff/ticket-summary";

/** "Summary from the order assistant": what the Customer approved before it went to the team, so they need not repeat themselves. */
export function AssistantSummaryCard({ summary }: { summary: TicketAssistantSummary }) {
  return (
    <section aria-label="Summary from the order assistant" className="flex w-full max-w-[600px] flex-col gap-2.5 border border-accent bg-lavender-soft px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-medium tracking-[0.35px] text-ink">
        <Sparkles aria-hidden className="size-4 text-primary" />
        {summary.source === "assistant" ? "Summary from the order assistant" : "Your note from the order assistant"}
      </h3>
      <ul className="flex flex-col gap-2">
        {summary.lines.map((line) => (
          <li className="flex gap-2 text-sm leading-[1.5] tracking-[0.35px] text-body" key={line}>
            <span aria-hidden className="mt-2 size-[5px] shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 break-words">{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs tracking-[0.35px] text-muted">Shared with our team so you don&apos;t have to repeat yourself.</p>
    </section>
  );
}
