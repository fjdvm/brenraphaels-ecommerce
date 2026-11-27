/**
 * Neon Auth saves cookies whenever its reply carries them, including while a
 * page renders, where Next.js refuses the write and the whole page would fail.
 * The session is still readable then, so only that refusal is skipped; Server
 * Actions and Route Handlers save the cookie as usual.
 */
export function writeCookieIfAllowed(write: () => void) {
  try {
    write();
  } catch (error) {
    const refused = error instanceof Error
      && error.message.startsWith("Cookies can only be modified in a Server Action or Route Handler");
    if (!refused) throw error;
  }
}
