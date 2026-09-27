import { describe, expect, test } from "vitest";

import { parseProductDescription } from "../lib/catalog/description";

describe("Product description parsing", () => {
  test("splits intro paragraphs from detail sections", () => {
    const description = [
      "Slow-cooked to perfection, this halaya offers a thick texture.",
      "Every spoonful delivers pure ube goodness.",
      "Why You’ll Love It",
      "• Made from 100% real ube",
      "• No food coloring",
      "Storage & Shelf Life",
      "• Keep refrigerated upon receiving",
      "Shelf Life:",
      "• 1–3 days at room temperature",
      "• 30–45 days refrigerated",
      "Delivery & Payment",
      "✔ Cash on Delivery (COD) available\n✔ GCash payment accepted",
    ].join("\n\n");

    expect(parseProductDescription(description)).toEqual({
      summary: [
        "Slow-cooked to perfection, this halaya offers a thick texture.",
        "Every spoonful delivers pure ube goodness.",
      ],
      sections: [
        {
          heading: "Why You’ll Love It",
          lines: [
            { kind: "item", text: "Made from 100% real ube" },
            { kind: "item", text: "No food coloring" },
          ],
        },
        {
          heading: "Storage & Shelf Life",
          lines: [
            { kind: "item", text: "Keep refrigerated upon receiving" },
            { kind: "label", text: "Shelf Life" },
            { kind: "item", text: "1–3 days at room temperature" },
            { kind: "item", text: "30–45 days refrigerated" },
          ],
        },
        {
          heading: "Delivery & Payment",
          lines: [
            { kind: "item", text: "Cash on Delivery (COD) available" },
            { kind: "item", text: "GCash payment accepted" },
          ],
        },
      ],
    });
  });

  test("treats a description with no headings as summary only", () => {
    const description = "Pure ube powder ground to 120 mesh ultra-fine consistency.";

    expect(parseProductDescription(description)).toEqual({
      summary: [description],
      sections: [],
    });
  });
});
