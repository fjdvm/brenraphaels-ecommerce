type Line = { street: string; barangay: string; city: string; province: string; postalCode: string };

/** One line for a saved Address; a Metro Manila or independent-city Address has no Province, so it is left out. */
export function formatAddressLine({ street, barangay, city, province, postalCode }: Line): string {
  return `${[street, barangay, city, province].filter(Boolean).join(", ")} ${postalCode}`;
}
