import type { FeedbackEnvironment, FeedbackReport } from "./report";

export type FeedbackIdentityResolver = () => Promise<string>;

/** Parses only the request header; feedback clients cannot forge these values. */
export function userAgentEnvironment(userAgent: string) {
  const browserMatch = /Edg\/([\d.]+)/.exec(userAgent) ?? /Firefox\/([\d.]+)/.exec(userAgent) ?? /OPR\/([\d.]+)/.exec(userAgent) ?? /Chrome\/([\d.]+)/.exec(userAgent) ?? /Version\/([\d.]+).*Safari/.exec(userAgent);
  const browserName = browserMatch?.[0].startsWith("Edg/") ? "Microsoft Edge" : browserMatch?.[0].startsWith("Firefox/") ? "Firefox" : browserMatch?.[0].startsWith("OPR/") ? "Opera" : browserMatch?.[0].startsWith("Chrome/") ? "Chrome" : browserMatch ? "Safari" : "Unknown";
  const browser = browserMatch ? `${browserName} ${browserMatch[1]}` : browserName;
  const windows = /Windows NT ([\d.]+)/.exec(userAgent);
  const android = /Android ([\d.]+)/.exec(userAgent);
  const ios = /(?:iPhone|iPad).*OS ([\d_]+)/.exec(userAgent);
  const macOS = /Mac OS X ([\d_.]+)/.exec(userAgent);
  const operatingSystem = windows ? `Windows ${windows[1]}` : android ? `Android ${android[1]}` : ios ? `iOS ${ios[1].replace(/_/g, ".")}` : macOS ? `macOS ${macOS[1].replace(/_/g, ".")}` : /Linux/.test(userAgent) ? "Linux" : "Unknown";
  const deviceType = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent) ? "tablet" : /Mobi|iPhone|Android/i.test(userAgent) ? "mobile" : "desktop";
  return { browser, operatingSystem, deviceType };
}

/** Vercel injects these values for each deployment; no release number is maintained by hand. */
export function deploymentMetadata() {
  return {
    appEnvironment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "unknown",
  };
}

export async function feedbackEnvironment(
  report: FeedbackReport,
  userAgent: string | null,
  resolveIdentity: FeedbackIdentityResolver,
): Promise<FeedbackEnvironment> {
  return {
    ...report.environment,
    ...userAgentEnvironment(userAgent ?? ""),
    ...deploymentMetadata(),
    identity: await resolveIdentity(),
  };
}
