/** The sidebar belongs to the Customer's account pages; every other page is full width. */
export function shouldShowCustomerSidebar(pathname: string) {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}
