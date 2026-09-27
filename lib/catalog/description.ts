const BULLET_PATTERN = /^[•✔]\s*/;

function isBulletBlock(block: string) {
  return BULLET_PATTERN.test(block);
}

export type ProductDescriptionLine =
  | { kind: "label"; text: string }
  | { kind: "item"; text: string };

export type ProductDescriptionSection = {
  heading: string;
  lines: ProductDescriptionLine[];
};

export type ParsedProductDescription = {
  /** The free-flowing intro paragraphs, shown outright rather than tucked into a section. */
  summary: string[];
  sections: ProductDescriptionSection[];
};

/**
 * Staff write a Product's description as one free-text field: a few intro
 * paragraphs, then a run of "Heading" / "• bullet" blocks (a bare
 * "Label:" block introduces a further run of bullets under the same
 * heading, e.g. "Shelf Life:" under "Storage & Shelf Life"). This turns
 * that shape into intro text plus a list of sections, so the page can show
 * the intro up front and the rest as collapsible details.
 */
export function parseProductDescription(description: string): ParsedProductDescription {
  const blocks = description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const summary: string[] = [];
  let index = 0;
  while (index < blocks.length && !isBulletBlock(blocks[index]) && blocks[index].endsWith(".")) {
    summary.push(blocks[index]);
    index++;
  }

  const sections: ProductDescriptionSection[] = [];
  let current: ProductDescriptionSection | undefined;
  for (; index < blocks.length; index++) {
    const block = blocks[index];
    if (isBulletBlock(block)) {
      const items = block
        .split("\n")
        .map((line) => line.trim().replace(BULLET_PATTERN, ""))
        .filter(Boolean);
      current?.lines.push(...items.map((text) => ({ kind: "item" as const, text })));
      continue;
    }
    if (current && block.endsWith(":")) {
      current.lines.push({ kind: "label", text: block.slice(0, -1) });
      continue;
    }
    current = { heading: block, lines: [] };
    sections.push(current);
  }

  return { summary, sections };
}
