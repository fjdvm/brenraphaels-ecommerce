const sidebarlessPaths = new Set([
  "/",
  "/about",
  "/journey",
  "/vision-mission",
  "/faq",
  "/contact",
  "/products",
  "/cart",
  "/checkout",
  "/support",
]);

/** Storefront and Support pages are full width; the sidebar belongs to the Customer's account pages. */
const sidebarlessPrefixes = ["/products/", "/support/"];

export function shouldShowCustomerSidebar(pathname: string) {
  return !sidebarlessPaths.has(pathname)
    && !sidebarlessPrefixes.some((prefix) => pathname.startsWith(prefix));
}
