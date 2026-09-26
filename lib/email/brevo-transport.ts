import nodemailer from "nodemailer";

export function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

/** A Brevo SMTP connection, and the sender every message from the shop uses. */
export function createBrevoTransport() {
  const smtpPort = Number(requiredEnvironment("BREVO_SMTP_PORT"));
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error("BREVO_SMTP_PORT must be a valid port number");
  }

  const transport = nodemailer.createTransport({
    auth: {
      pass: requiredEnvironment("BREVO_SMTP_KEY"),
      user: requiredEnvironment("BREVO_SMTP_USER"),
    },
    host: requiredEnvironment("BREVO_SMTP_HOST"),
    connectionTimeout: 2_000,
    greetingTimeout: 2_000,
    port: smtpPort,
    secure: smtpPort === 465,
    socketTimeout: 3_000,
  });

  return {
    transport,
    sender: {
      address: requiredEnvironment("EMAIL_FROM_ADDRESS"),
      name: requiredEnvironment("EMAIL_FROM_NAME"),
    },
  };
}
