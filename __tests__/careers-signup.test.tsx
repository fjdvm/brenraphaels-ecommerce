// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createLogin, sendVerificationEmail } = vi.hoisted(() => ({ createLogin: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/careers/auth", () => ({ careersApplicantAuth: { createLogin, sendVerificationEmail } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

import { CareersToaster } from "@/app/(careers)/careers/_components/action-toast";
import { submitApplicantSignUp } from "@/app/(careers)/careers/(auth)/signup/actions";
import ApplicantSignUpPage from "@/app/(careers)/careers/(auth)/signup/page";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = { firstName: "Juan", middleName: "", lastName: "Dela Cruz", email: "juan@example.com", password: "Passw0rd!x", confirmPassword: "Passw0rd!x", ...overrides };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  createLogin.mockReset();
  sendVerificationEmail.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  cleanup();
  vi.restoreAllMocks();
});

describe("Careers sign-up action", () => {
  test("words an incomplete email and a password mismatch as the design does", async () => {
    const state = await submitApplicantSignUp({}, form({ email: "fitz.martin@gmail", confirmPassword: "Different1!" }));
    expect(state.status).toBe("invalid");
    expect(state.fieldErrors?.email).toEqual(["Enter a full email address, like name@gmail.com"]);
    expect(state.fieldErrors?.confirmPassword).toEqual(["Passwords don’t match"]);
    expect(createLogin).not.toHaveBeenCalled();
  });

  test("rejects a character a name never holds with the validator's message, and does not strip it", async () => {
    const state = await submitApplicantSignUp({}, form({ firstName: "Juan3" }));
    expect(state.status).toBe("invalid");
    expect(state.fieldErrors?.firstName?.[0]).toMatch(/\S/);
    expect(state.fieldErrors?.firstName?.[0]).not.toBe("Enter a full email address, like name@gmail.com");
    expect(state.values?.firstName).toBe("Juan3");
    expect(createLogin).not.toHaveBeenCalled();
  });

  test("a general failure keeps what was typed, never the passwords", async () => {
    createLogin.mockRejectedValue(new Error("down"));
    const state = await submitApplicantSignUp({}, form());
    expect(state.status).toBe("failed");
    expect(state.message).toBe("We couldn't create your Applicant account. Please try again.");
    expect(state.values).toEqual({ firstName: "Juan", middleName: "", lastName: "Dela Cruz", email: "juan@example.com" });
  });
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}\\*?$`)), { target: { value } });
}

describe("Careers sign-up page", () => {
  test("shows field errors beside the fields and keeps the typed values", async () => {
    render(<ApplicantSignUpPage />);
    fill("First name", "Juan");
    fill("Last name", "Dela Cruz");
    fill("Email address", "fitz.martin@gmail");
    fill("Password", "Passw0rd!x");
    fill("Confirm password", "Different1!");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create applicant account/i }).closest("form")!);
    });
    const email = await screen.findByText("Enter a full email address, like name@gmail.com");
    expect(email.closest("[role=alert]")).toBeTruthy();
    expect(screen.getByLabelText(/^Email address\*?$/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Passwords don’t match")).toBeTruthy();
    expect((screen.getByLabelText(/^Email address\*?$/) as HTMLInputElement).value).toBe("fitz.martin@gmail");
    expect((screen.getByLabelText(/^First name\*?$/) as HTMLInputElement).value).toBe("Juan");
  });

  test("a general failure shows a clear message and the Retry card, and keeps typed values", async () => {
    createLogin.mockRejectedValue(new Error("down"));
    render(<><CareersToaster /><ApplicantSignUpPage /></>);
    fill("First name", "Juan");
    fill("Last name", "Dela Cruz");
    fill("Email address", "juan@example.com");
    fill("Password", "Passw0rd!x");
    fill("Confirm password", "Passw0rd!x");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create applicant account/i }).closest("form")!);
    });
    await waitFor(() => expect(screen.getAllByText("We couldn't create your Applicant account. Please try again.").length).toBeGreaterThan(1));
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect((screen.getByLabelText(/^Email address\*?$/) as HTMLInputElement).value).toBe("juan@example.com");
    expect((screen.getByLabelText(/^First name\*?$/) as HTMLInputElement).value).toBe("Juan");
  });

  test("shows the shared loading card while creating the account", async () => {
    let release!: () => void;
    createLogin.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
    render(<><CareersToaster /><ApplicantSignUpPage /></>);
    fill("First name", "Juan");
    fill("Last name", "Dela Cruz");
    fill("Email address", "juan@example.com");
    fill("Password", "Passw0rd!x");
    fill("Confirm password", "Passw0rd!x");
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /create applicant account/i }).closest("form")!);
    });
    expect(await screen.findByRole("progressbar")).toBeTruthy();
    await act(async () => release());
  });
});
