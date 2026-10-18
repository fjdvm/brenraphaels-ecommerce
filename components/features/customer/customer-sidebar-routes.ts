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
]);

/** Storefront pages are full width; the sidebar belongs to the Customer's account pages. */
const sidebarlessPrefixes = ["/products/"];

export function shouldShowCustomerSidebar(pathname: string) {
  return !sidebarlessPaths.has(pathname)
    && !sidebarlessPrefixes.some((prefix) => pathname.startsWith(prefix));
}
