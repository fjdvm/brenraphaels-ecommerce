import { describe, expect, test, vi } from "vitest";

import { signInCustomer } from "../lib/customer/sign-in";

function authStub(result: "signed-in" | "invalid" | "unverified") {
  return { signIn: vi.fn().mockResolvedValue(result) };
}

describe("Customer sign-in", () => {
  test("signs in a Verified Customer with a normalised email", async () => {
    const auth = authStub("signed-in");

    await expect(
      signInCustomer(
        { email: "  Jane@Example.com ", password: "Password1" },
        { auth },
      ),
    ).resolves.toEqual({ status: "signed-in" });
    expect(auth.signIn).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Password1",
    });
  });

  test("gives the same message for a wrong email and a wrong password", async () => {
    const wrongPassword = await signInCustomer(
      { email: "jane@example.com", password: "Wrong1234" },
      { auth: authStub("invalid") },
    );
    const wrongEmail = await signInCustomer(
      { email: "nobody@example.com", password: "Password1" },
      { auth: authStub("invalid") },
    );

    expect(wrongPassword).toEqual(wrongEmail);
    expect(wrongPassword).toMatchObject({ status: "invalid" });
  });

  test("blocks an unverified Customer and offers to resend the email", async () => {
    await expect(
      signInCustomer(
        { email: "jane@example.com", password: "Password1" },
        { auth: authStub("unverified") },
      ),
    ).resolves.toEqual({ status: "unverified", email: "jane@example.com" });
  });

  test("treats a malformed email or empty password as invalid without asking Neon", async () => {
    const auth = authStub("signed-in");

    await expect(
      signInCustomer({ email: "not-an-email", password: "Password1" }, { auth }),
    ).resolves.toMatchObject({ status: "invalid" });
    await expect(
      signInCustomer({ email: "jane@example.com", password: "" }, { auth }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
