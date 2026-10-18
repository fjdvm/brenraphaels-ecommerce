import { describe, expect, test } from "vitest";

import { filterFaqGroups, type FaqGroup } from "../lib/faq/faq-search";

const groups: FaqGroup[] = [
  {
    heading: "Our Ube",
    faqs: [
      {
        question: "What is your shelf life?",
        answer: { paragraphs: ["Ube Jam: up to 3 weeks."] },
      },
      {
        question: "Where do you source your raw ube?",
        answer: { paragraphs: ["From trusted farmers in Batangas."] },
      },
    ],
  },
  {
    heading: "Payment",
    faqs: [
      {
        question: "Payment Methods",
        answer: { bullets: ["Cash on Delivery (COD)", "GCash"] },
      },
    ],
  },
];

describe("Searching the FAQ", () => {
  test("keeps everything when the search is empty", () => {
    expect(filterFaqGroups(groups, "")).toEqual(groups);
    expect(filterFaqGroups(groups, "   ")).toEqual(groups);
  });

  test("matches questions regardless of case", () => {
    const result = filterFaqGroups(groups, "SHELF");

    expect(result).toEqual([{ heading: "Our Ube", faqs: [groups[0].faqs[0]] }]);
  });

  test("matches words in the answer, including bullets", () => {
    expect(filterFaqGroups(groups, "gcash").map((group) => group.heading)).toEqual(["Payment"]);
    expect(filterFaqGroups(groups, "batangas").map((group) => group.heading)).toEqual(["Our Ube"]);
  });

  test("needs every word to match somewhere in the same question", () => {
    expect(filterFaqGroups(groups, "shelf weeks")).toHaveLength(1);
    expect(filterFaqGroups(groups, "shelf gcash")).toEqual([]);
  });

  test("drops groups with no matching question", () => {
    expect(filterFaqGroups(groups, "zzz")).toEqual([]);
  });
});
