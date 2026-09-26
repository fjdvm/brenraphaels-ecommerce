import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/complete-profile/actions", () => ({
  submitCompleteProfile: async () => ({}),
}));

const { CompleteProfileForm } = await import(
  "../components/features/auth/complete-profile-form"
);

const markup = renderToStaticMarkup(
  <CompleteProfileForm
    email="jane@example.com"
    defaults={{ firstName: "Jane", middleName: "", lastName: "Doe" }}
    provinces={["Cebu", "Metro Manila"]}
  />,
);

function attributeValues(attribute: string, tag: string) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*?\\s${attribute}="([^"]*)"`, "g"))].map(
    (match) => match[1],
  );
}

describe("The complete-profile form, for keyboard and phone use", () => {
  test("gives every control a label, so it can be reached and named without a mouse", () => {
    const controlIds = [...attributeValues("id", "input"), ...attributeValues("id", "select")];
    const labelTargets = attributeValues("for", "label");

    expect(controlIds.length).toBeGreaterThan(0);
    expect(labelTargets.sort()).toEqual(controlIds.sort());
  });

  test("groups the Marketing opt-in answers under a question, with neither pre-selected", () => {
    expect(markup).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Would you like marketing emails\?/);
    expect(markup).not.toMatch(/type="radio"[^>]*checked/);
  });

  test("pre-fills the name that is already known from the login", () => {
    expect(markup).toMatch(/name="firstName"[^>]*value="Jane"|value="Jane"[^>]*name="firstName"/);
    expect(markup).toMatch(/name="lastName"[^>]*value="Doe"|value="Doe"[^>]*name="lastName"/);
  });

  test("asks a phone for the right keyboard and lets it autofill", () => {
    expect(markup).toMatch(/type="tel"/);
    expect(markup).toMatch(/inputMode="tel"/);
    expect(markup).toContain('autoComplete="tel"');
    expect(markup).toContain('autoComplete="postal-code"');
  });

  test("makes Province, City and Barangay dropdowns, with only the province filled in at first", () => {
    for (const name of ["province", "city", "barangay"]) {
      expect(markup).toMatch(new RegExp(`<select[^>]*name="${name}"`));
      expect(markup).not.toMatch(new RegExp(`<input[^>]*name="${name}"`));
    }
    expect(markup).toContain('<option value="Cebu">Cebu</option>');
    expect(markup).toMatch(/<select[^>]*disabled=""[^>]*name="city"|<select[^>]*name="city"[^>]*disabled=""/);
    expect(markup).toMatch(/<select[^>]*disabled=""[^>]*name="barangay"|<select[^>]*name="barangay"[^>]*disabled=""/);
  });

  test("has one submit button and never takes a control out of the tab order", () => {
    expect(markup.match(/type="submit"/g)).toHaveLength(1);
    expect(markup).not.toMatch(/tabIndex/i);
  });
});
