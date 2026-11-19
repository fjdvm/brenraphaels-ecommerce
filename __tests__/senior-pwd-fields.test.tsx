// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

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
});
