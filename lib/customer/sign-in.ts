import { z } from "zod";

export const invalidCredentialsMessage = "Incorrect email or password.";

export type SignInAuth = {
  signIn(credentials: {
    email: string;
    password: string;
  }): Promise<"signed-in" | "invalid" | "unverified">;
};

export type SignInResult =
  | { status: "signed-in" }
  | { status: "invalid"; message: string }
  | { status: "unverified"; email: string };

const credentialsSchema = z.object({
  email: z.string().trim().max(256).email(),
  password: z.string().min(1).max(128),
});

export async function signInCustomer(
  input: { email: string; password: string },
  dependencies: { auth: SignInAuth },
): Promise<SignInResult> {
  const credentials = credentialsSchema.safeParse(input);
  if (!credentials.success) {
    return { status: "invalid", message: invalidCredentialsMessage };
  }

  const email = credentials.data.email.toLowerCase();
  const outcome = await dependencies.auth.signIn({
    email,
    password: credentials.data.password,
  });

  if (outcome === "signed-in") {
    return { status: "signed-in" };
  }
  if (outcome === "unverified") {
    return { status: "unverified", email };
  }
  return { status: "invalid", message: invalidCredentialsMessage };
}
