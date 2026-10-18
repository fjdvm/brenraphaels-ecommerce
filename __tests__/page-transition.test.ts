import { describe, expect, test } from "vitest";

import {
  TRANSITION_MS,
  remainingMs,
  transitionTarget,
} from "../lib/site/page-transition";

const origin = "https://shop.test";
const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const link = (href: string, extra: { target?: string; download?: boolean } = {}) => ({
  href: new URL(href, origin).href,
  target: extra.target ?? "",
  download: extra.download ?? false,
});

describe("The page transition", () => {
  test("starts for a plain click on a link to another page of the site", () => {
    expect(transitionTarget(link("/about"), `${origin}/`, plain)).toBe("/about");
  });

  test("does not start for the page already open, a hash, or only a changed query", () => {
    expect(transitionTarget(link("/about"), `${origin}/about`, plain)).toBeNull();
    expect(transitionTarget(link("/about#top"), `${origin}/about`, plain)).toBeNull();
    expect(transitionTarget(link("/products?sort=price"), `${origin}/products`, plain)).toBeNull();
  });

  test("does not start for another site, a new tab, a download or a modified click", () => {
    expect(transitionTarget(link("https://other.test/about"), `${origin}/`, plain)).toBeNull();
    expect(transitionTarget(link("/about", { target: "_blank" }), `${origin}/`, plain)).toBeNull();
    expect(transitionTarget(link("/about", { download: true }), `${origin}/`, plain)).toBeNull();
    expect(transitionTarget(link("/about"), `${origin}/`, { ...plain, metaKey: true })).toBeNull();
    expect(transitionTarget(link("/about"), `${origin}/`, { ...plain, button: 1 })).toBeNull();
  });

  test("holds the screen for the full 1.5s even when the page is already ready", () => {
    expect(TRANSITION_MS).toBe(1500);
    expect(remainingMs(1000, 1200)).toBe(1300);
    expect(remainingMs(1000, 4000)).toBe(0);
  });
});
