// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const readIdPhotoText = vi.hoisted(() => vi.fn(async (_file: Blob) => "OSCA ID No.: 0458721"));
vi.mock("@/lib/senior-pwd/id-photo-reading", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/senior-pwd/id-photo-reading")>()),
  readIdPhotoText,
}));

import { SeniorPwdFields } from "@/components/features/auth/senior-pwd-fields";

afterEach(cleanup);

describe("the Senior/PWD fields", () => {
  test("ask the question first and show no ID fields until the answer is yes", () => {
    render(<SeniorPwdFields errors={{}} />);
    expect(screen.getByText(/Are you a Senior Citizen or PWD/)).toBeTruthy();
    expect(screen.queryByLabelText(/ID number/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Yes"));
    expect(screen.getByLabelText("Senior Citizen ID")).toBeTruthy();
    expect(screen.getByLabelText("PWD ID")).toBeTruthy();
    expect(screen.getByLabelText(/ID number/)).toBeTruthy();
    expect(screen.getByLabelText(/Front of ID \(required\)/)).toBeTruthy();
    expect(screen.getByLabelText(/Back of ID/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("No"));
    expect(screen.queryByLabelText(/ID number/)).toBeNull();
  });

  test("show the ID fields straight away where the Customer has already said yes", () => {
    render(<SeniorPwdFields askFirst={false} errors={{}} />);
    expect(screen.queryByText(/Are you a Senior Citizen or PWD/)).toBeNull();
    expect(screen.getByLabelText(/ID number/)).toBeTruthy();
  });

  test("show the field errors they are given", () => {
    render(<SeniorPwdFields errors={{ seniorPwd: ["Tell us if you're a Senior Citizen or PWD"] }} />);
    expect(screen.getByRole("alert").textContent).toContain("Tell us if you're a Senior Citizen or PWD");
  });

  test("read the number off the chosen photo, fill the empty field, and send the reading for comparison", async () => {
    const { container } = render(<SeniorPwdFields askFirst={false} errors={{}} />);
    fireEvent.change(screen.getByLabelText(/Front of ID \(required\)/), { target: { files: [new File(["x"], "front.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect((screen.getByLabelText(/ID number/) as HTMLInputElement).value).toBe("0458721"));
    expect(screen.getByText(/check it matches the number on the card/)).toBeTruthy();
    expect((container.querySelector('input[name="idNumberRead"]') as HTMLInputElement).value).toBe("0458721");
  });

  test("never overwrite a number the Customer typed, and ask them to type it when the photo can't be read", async () => {
    readIdPhotoText.mockRejectedValueOnce(new Error("no worker"));
    render(<SeniorPwdFields askFirst={false} errors={{}} />);
    const number = screen.getByLabelText(/ID number/) as HTMLInputElement;
    fireEvent.change(number, { target: { value: "TYPED-123" } });
    fireEvent.change(screen.getByLabelText(/Front of ID \(required\)/), { target: { files: [new File(["x"], "front.jpg", { type: "image/jpeg" })] } });
    await screen.findByText(/couldn't read the number from the photo; please type it/);
    expect(number.value).toBe("TYPED-123");
  });
});
