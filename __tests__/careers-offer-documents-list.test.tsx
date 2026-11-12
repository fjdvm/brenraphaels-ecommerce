import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ApplicationDocuments } from "../app/(careers)/careers/_components/application-documents";
import type { RequiredDocument } from "../lib/careers/application-offer";

const rows: RequiredDocument[] = [
  { type: "nbi", name: "NBI clearance", hint: "Not older than 6 months", status: "To upload", dueDate: "2026-11-20" },
  { type: "resume", name: "Resume", status: "Submitted", dueDate: null },
];

describe("requested documents on the Application page", () => {
  const markup = renderToStaticMarkup(<ApplicationDocuments documents={[]} required={rows} referenceNumber="BR-APP-1" />);

  test("a Requested row shows its due date and its own Upload button", () => {
    expect(markup).toContain("Due 20 Nov");
    expect(markup).toContain('aria-label="Upload NBI clearance"');
  });

  test("a Submitted row shows no Upload button", () => {
    expect(markup).not.toContain('aria-label="Upload Resume"');
    expect(markup).toContain("Submitted");
    expect(markup).toContain("1 of 2");
  });

  test("only the requested documents are listed", () => {
    expect(markup).not.toContain("SSS number");
    expect(markup.match(/<li /g)).toHaveLength(2);
  });
});
