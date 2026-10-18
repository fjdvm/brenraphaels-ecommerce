import { describe, expect, test } from "vitest";

import { shouldShowCustomerSidebar } from "../components/features/customer/customer-sidebar-routes";

describe("Customer sidebar shell", () => {
  test.each([
    "/",
    "/about",
    "/journey",
    "/vision-mission",
    "/faq",
    "/contact",
    "/products",
    "/products/ube-halaya-smooth",
    "/cart",
    "/checkout",
    "/support",
    "/support/12",
    "/support/new",
    "/returns",
    "/terms",
    "/privacy",
  ])(
    "hides the sidebar on %s",
    (pathname) => {
      expect(shouldShowCustomerSidebar(pathname)).toBe(false);
    },
  );

  test.each(["/profile", "/profile/orders", "/profile/addresses", "/profile/settings"])(
    "keeps the sidebar on %s",
    (pathname) => {
      expect(shouldShowCustomerSidebar(pathname)).toBe(true);
    },
  );
});
