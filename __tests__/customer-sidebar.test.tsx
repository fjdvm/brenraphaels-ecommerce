import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/actions", () => ({ signOut: async () => {} }));

import { CustomerSidebarNavList } from "../components/features/customer/customer-sidebar";

describe("The Customer sidebar navigation", () => {
  test("links to every Customer destination and marks only the current route", () => {
    const markup = renderToStaticMarkup(
      <CustomerSidebarNavList pathname="/profile/orders" />,
    );

    expect(markup).toContain('href="/profile/orders"');
    expect(markup).toContain('href="/support"');
    expect(markup).toContain('href="/profile/addresses"');
    expect(markup).toContain('href="/profile/notifications"');
    expect(markup).toContain('href="/profile/settings"');
    expect(markup).toMatch(/<a(?=[^>]*href="\/profile\/orders")(?=[^>]*aria-current="page")/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain("Sign out");
    expect(markup).not.toContain('href="/cart"');
  });
});
