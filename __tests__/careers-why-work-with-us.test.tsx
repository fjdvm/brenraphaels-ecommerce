import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { WhyWorkWithUs } from "../components/features/careers/why-work-with-us";

describe("Why work with us", () => {
  const markup = renderToStaticMarkup(<WhyWorkWithUs />);

  test("is the target of the Life at Bren Raphael's link", () => {
    expect(markup).toContain('id="life"');
    expect(markup).toContain("Life at Bren Raphael&#x27;s");
    expect(markup).toContain("Why work with us");
  });

  test("shows the three cards with the design's wording", () => {
    expect(markup.match(/<li /g)).toHaveLength(3);
    for (const text of [
      "A family business",
      "Grow with a team built on family, faith and perseverance.",
      "Proudly Filipino",
      "Help bring authentic ube flavors closer to every home.",
      "Real impact",
      "Support local communities and better income for Filipino farmers.",
    ]) expect(markup).toContain(text);
  });

  test("stacks on phones and goes three-up from md", () => {
    expect(markup).toContain("grid gap-5 md:grid-cols-3");
  });
});
