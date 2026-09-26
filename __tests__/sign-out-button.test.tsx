import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { SignOutButton } from "../components/shared/sign-out-button";

const markup = renderToStaticMarkup(<SignOutButton action={async () => {}} />);

describe("The Sign out button", () => {
  test("does not sign anyone out by itself: it is a plain button that only opens the confirmation", () => {
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Sign out<\/button>/);
    expect(markup).not.toContain("<form");
  });

  test("shows no confirmation until it is pressed", () => {
    expect(markup).not.toContain("Sign out?");
  });
});
