import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createCustomerStore,
  createWelcomeEmailStore,
  signUpCustomer,
  type CustomerSignUp,
} from "../lib/customer/sign-up";
import { renderWelcomeEmail } from "../lib/email/welcome-email";
import { createTestDatabase } from "./helpers/test-database";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.example",
}));

const signUp: CustomerSignUp = {
  firstName: "Jane", lastName: "Doe", email: "jane@example.com",
  password: "Password1!", confirmPassword: "Password1!", contactNumber: "09171234567",
  street: "123 Katipunan Avenue", barangay: "Loyola Heights", city: "Quezon City",
  province: "Metro Manila", postalCode: "1108", marketingOptIn: "yes", terms: true,
};

let client: PGlite;
beforeEach(async () => { client = await createTestDatabase(); });
afterEach(async () => { await client.close(); });

function run(send: (e: string, n: string) => Promise<void>) {
  const db = drizzle(client);
  return signUpCustomer(signUp, {
    auth: {
      createLogin: vi.fn().mockResolvedValue({ userId: "u1" }),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    },
    customerStore: createCustomerStore(db),
    welcome: { store: createWelcomeEmailStore(db), send },
  });
}

describe("welcome email", () => {
  test("a retried sign-up sends one welcome email", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await run(send);
    await run(send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("jane@example.com", "Jane");
  });

  test("a failed send does not fail sign-up and leaves the email unclaimed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp down")).mockResolvedValue(undefined);
    await expect(run(send)).resolves.toEqual({ email: "jane@example.com" });
    expect(await createWelcomeEmailStore(drizzle(client)).claim("u1")).toBe(true);
  });

  test("renders the shop's design with the Customer's name", () => {
    const { html, subject } = renderWelcomeEmail({ firstName: "<Jane>", shopUrl: "https://s/shop", logoUrl: "https://s/l.jpeg" });
    expect(subject).toContain("Welcome");
    expect(html).toContain("Welcome, &lt;Jane&gt;");
  });
});
