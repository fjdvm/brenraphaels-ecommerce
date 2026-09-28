import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CustomerSidebarNavList } from "../components/features/customer/customer-sidebar";

describe("The Customer sidebar navigation", () => {
  test("links to every Customer destination and marks only the current route", () => {
    const markup = renderToStaticMarkup(
      <CustomerSidebarNavList pathname="/profile/orders" />,
    );

    expect(markup).toContain('href="/products"');
    expect(markup).toContain('href="/profile/orders"');
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain('href="/profile/addresses"');
    expect(markup).toContain('href="/profile/notifications"');
    expect(markup).toContain('href="/profile/settings"');
    expect(markup).toMatch(/<a(?=[^>]*href="\/profile\/orders")(?=[^>]*aria-current="page")/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).not.toContain("Sign out");
  });
});
