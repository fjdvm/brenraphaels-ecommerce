"use client";

import { AlertCircle, Bell, Check, X } from "lucide-react";
import { useCallback } from "react";
import { Toaster, toast } from "sonner";

/** What an action reports back: success, or a message to show with Retry. */
export type ActionOutcome = { ok: true } | { ok: false; message: string };

export type ActionToastOptions = {
  /** Shown while the action runs, e.g. "Saving…". */
  loading: string;
  /** Shown when it succeeds, e.g. "Profile saved". The card then dismisses itself. */
  success: string;
  /** Fallback when the action fails without a message. */
  error?: string;
  /** Runs the create, update or delete. Called again on Retry. */
  task: () => Promise<ActionOutcome>;
};

const SUCCESS_MS = 4000;

type CardState = { phase: "loading"; text: string } | { phase: "success"; text: string } | { phase: "error"; text: string; retry: () => void };

/** The one bottom-right card: progress (indeterminate, never a made-up percentage), then the result in the same card. */
export function ActionToastCard({ state, onDismiss }: { state: CardState; onDismiss: () => void }) {
  return (
    <div role="status" className="relative w-[calc(100vw-32px)] max-w-[380px] overflow-hidden rounded-2xl bg-ink text-white shadow-[0_12px_16px_rgba(43,26,69,0.25)] sm:w-auto sm:min-w-[300px]">
      <div className="flex items-center gap-3 py-3.5 pl-3.5 pr-4">
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-[14px] text-white ${state.phase === "error" ? "bg-red-600" : "bg-primary"}`}>
          {state.phase === "success" ? <Check className="size-3.5" /> : state.phase === "error" ? <AlertCircle className="size-3.5" /> : <Bell className="size-3.5" />}
        </span>
        <p className="text-sm font-medium tracking-[0.35px]">{state.text}</p>
        {state.phase === "error" ? (
          <button type="button" onClick={state.retry} className="text-sm font-medium tracking-[0.35px] text-accent hover:text-white">
            Retry
          </button>
        ) : null}
        {state.phase !== "loading" ? (
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="ml-auto text-white/80 hover:text-white">
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      {state.phase === "loading" ? (
        <div role="progressbar" aria-label={state.text} className="h-1 w-full overflow-hidden bg-white/15">
          <div className="h-full w-1/3 animate-[action-toast-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
        </div>
      ) : null}
    </div>
  );
}

let nextId = 0;

function show(id: string, state: CardState) {
  toast.custom(() => <ActionToastCard state={state} onDismiss={() => toast.dismiss(id)} />, {
    id,
    duration: state.phase === "success" ? SUCCESS_MS : Infinity,
    dismissible: state.phase !== "loading",
  });
}

/** Runs a task behind one card that turns from progress into the result. Several runs stack. Resolves with the outcome. */
export async function runWithToast({ loading, success, error = "Something went wrong. Try again.", task }: ActionToastOptions): Promise<ActionOutcome> {
  const id = `action-toast-${++nextId}`;
  const attempt = async (): Promise<ActionOutcome> => {
    show(id, { phase: "loading", text: loading });
    let outcome: ActionOutcome;
    try {
      outcome = await task();
    } catch {
      outcome = { ok: false, message: error };
    }
    if (outcome.ok) show(id, { phase: "success", text: success });
    else show(id, { phase: "error", text: outcome.message || error, retry: () => void attempt() });
    return outcome;
  };
  return attempt();
}

/** Hook form of {@link runWithToast}; the returned function is stable. */
export function useActionToast() {
  return useCallback((options: ActionToastOptions) => runWithToast(options), []);
}

/** Mounted once in the Careers layout. Sits above the bottom tab bar on mobile; toasts are a polite live region. */
export function CareersToaster() {
  return <Toaster position="bottom-right" visibleToasts={5} offset={{ right: 40, bottom: 32 }} mobileOffset={{ right: 16, left: 16, bottom: 88 }} />;
}
