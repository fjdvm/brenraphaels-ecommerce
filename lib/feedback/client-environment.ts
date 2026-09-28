const maximumConsoleErrors = 10;
const maximumConsoleErrorLength = 1_000;
const feedbackConsoleCapture = Symbol.for("bren-raphaels.feedback-console-capture");

type FeedbackConsoleState = { errors: string[]; installed: boolean };

function state() {
  const feedbackWindow = window as Window & { [feedbackConsoleCapture]?: FeedbackConsoleState };
  if (!feedbackWindow[feedbackConsoleCapture]) feedbackWindow[feedbackConsoleCapture] = { errors: [], installed: false };
  return feedbackWindow[feedbackConsoleCapture];
}

function consoleErrorText(values: unknown[]) {
  return values.map((value) => {
    if (value instanceof Error) return value.stack ?? value.message;
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  }).join(" ").slice(0, maximumConsoleErrorLength);
}

/** Installed by client instrumentation once per tab, before client navigation can remount UI. */
export function installFeedbackConsoleCapture() {
  const feedbackState = state();
  if (feedbackState.installed) return;
  feedbackState.installed = true;
  const originalError = console.error;
  console.error = (...values: unknown[]) => {
    const error = consoleErrorText(values);
    if (error) {
      feedbackState.errors.push(error);
      if (feedbackState.errors.length > maximumConsoleErrors) feedbackState.errors.shift();
    }
    originalError.apply(console, values);
  };
}

export function feedbackClientEnvironment() {
  const feedbackState = state();
  return {
    pageUrl: window.location.href,
    screenSize: `${window.screen.width} × ${window.screen.height}`,
    viewportSize: `${window.innerWidth} × ${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    consoleErrors: [...feedbackState.errors],
  };
}
