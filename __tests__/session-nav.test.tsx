import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/actions", () => ({ signOut: async () => {} }));

import { SessionNav } from "../components/shared/session-nav";

describe("Session navigation", () => {
  test("shows the initials avatar and first name, with the notifications bell and account menu, for a complete Customer", async () => {
    const markup = renderToStaticMarkup(
      <SessionNav
        visitor={{
          state: "customer",
          customer: {
            userId: "login-1",
            firstName: "Jane",
            middleName: null,
            lastName: "Doe",
            fullName: "Jane Doe",
            email: "jane@example.com",
            contactNumber: "09171234567",
            addresses: [],
          },
        }}
      />,
    );

    expect(markup).toContain('href="/cart"');
    expect(markup).toContain('href="/profile/notifications"');
    expect(markup).toContain("JD");
    expect(markup).toContain("Jane");
    for (const href of ["/profile/orders", "/support", "/profile/addresses", "/profile/settings"]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).toContain("Sign out");
  });

  test("keeps profile access for a Visitor who needs details", async () => {
    const markup = renderToStaticMarkup(
      <SessionNav
        visitor={{
          state: "needs-details",
          userId: "login-1",
          email: "jane@example.com",
          fullName: "Jane Doe",
        }}
      />,
    );

    expect(markup).toContain('href="/cart"');
    expect(markup).toContain('href="/profile"');
    expect(markup).not.toContain("Sign out");
  });

  test("keeps the Cart for a signed-out Visitor", async () => {
    const markup = renderToStaticMarkup(<SessionNav visitor={{ state: "signed-out" }} />);

    expect(markup).toContain('href="/cart"');
  });
});
