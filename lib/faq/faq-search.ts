export type FaqAnswer = { paragraphs?: string[]; bullets?: string[]; after?: string[] };
export type Faq = { question: string; answer: FaqAnswer };
export type FaqGroup = { heading: string; faqs: Faq[] };

function searchableText({ question, answer }: Faq) {
  return [question, ...(answer.paragraphs ?? []), ...(answer.bullets ?? []), ...(answer.after ?? [])]
    .join(" ")
    .toLowerCase();
}

/** The groups left once only the questions matching every word of `query` are kept. */
export function filterFaqGroups(groups: FaqGroup[], query: string): FaqGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return groups;
  }

  return groups
    .map((group) => ({
      ...group,
      faqs: group.faqs.filter((faq) => {
        const text = searchableText(faq);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.faqs.length > 0);
}
