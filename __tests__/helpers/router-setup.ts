import { vi } from "vitest";

// Components that refresh the page after a save read the App Router; tests render them without one.
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ back() {}, forward() {}, prefetch() {}, push() {}, refresh() {}, replace() {} }),
}));
