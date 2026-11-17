const apiBase = "https://console.neon.tech/api/v2";

/**
 * Removes a login from Neon Auth through Neon's management API. A login that is
 * already gone counts as removed, so a retried sign-up is safe.
 */
export async function removeNeonLogin(
  userId: string,
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const { NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID } = env;
  if (!NEON_API_KEY || !NEON_PROJECT_ID || !NEON_BRANCH_ID) {
    throw new Error("NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID are required to replace a login.");
  }
  const url = `${apiBase}/projects/${encodeURIComponent(NEON_PROJECT_ID)}/branches/${encodeURIComponent(NEON_BRANCH_ID)}/auth/users/${encodeURIComponent(userId)}`;
  const response = await fetcher(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${NEON_API_KEY}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Neon could not remove the old login (HTTP ${response.status}).`);
  }
}
