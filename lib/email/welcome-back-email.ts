import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";
import { renderBrandedEmail, type WelcomeEmailInput } from "./welcome-email";

const brandName = "Bren Raphael's Ube Jam & Halaya";

export function renderWelcomeBackEmail({ firstName, shopUrl, logoUrl }: WelcomeEmailInput) {
  return renderBrandedEmail({
    subject: `Welcome back to ${brandName}`,
    heading: `Welcome back, ${firstName}`,
    body: "Your account is back, with your orders and details just as you left them. Pick up where you stopped whenever you like.",
    reason: `You're receiving this email because you signed up again at ${brandName}.`,
    shopUrl,
    logoUrl,
  });
}

export async function sendWelcomeBackEmail(recipient: string, firstName: string) {
  const siteUrl = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const { transport, sender } = createBrevoTransport();
  const { subject, html, text } = renderWelcomeBackEmail({
    firstName,
    shopUrl: new URL("/shop", siteUrl).toString(),
    logoUrl: new URL("/logo.jpeg", siteUrl).toString(),
  });
  await transport.sendMail({ from: sender, to: recipient, subject, html, text });
}
