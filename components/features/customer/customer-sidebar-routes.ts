const sidebarlessPaths = new Set([
  "/",
  "/about",
  "/journey",
  "/vision-mission",
  "/faq",
  "/contact",
]);

export function shouldShowCustomerSidebar(pathname: string) {
  return !sidebarlessPaths.has(pathname);
}
