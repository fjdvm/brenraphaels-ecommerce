/**
 * The stable id of an email as its SMTP Message-ID, so the provider sees the same id on the first send, every retry
 * and every Resend of one event.
 */
export function stableMessageId(sender: { address: string }, email?: { id: string }) {
  if (!email) return {};
  return { messageId: `<${email.id}@${sender.address.split("@")[1] ?? "localhost"}>` };
}
