export function unsubscribeSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET is required to handle Unsubscribe links.");
  }

  return secret;
}
