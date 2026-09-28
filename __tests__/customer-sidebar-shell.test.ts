import { describe, expect, test } from "vitest";

import { shouldShowCustomerSidebar } from "../components/features/customer/customer-sidebar-shell";

describe("Customer sidebar shell", () => {
  test.each(["/", "/about", "/faq", "/contact"])(
    "hides the sidebar on %s",
    (pathname) => {
      expect(shouldShowCustomerSidebar(pathname)).toBe(false);
    },
  );

  test.each(["/products", "/cart", "/profile/orders"])(
    "keeps the sidebar on %s",
    (pathname) => {
      expect(shouldShowCustomerSidebar(pathname)).toBe(true);
    },
  );
});
