"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { DocumentViewer, documentKind, documentSize, type ViewableDocument } from "./document-viewer";

const kindLabel = { image: "Image", pdf: "PDF", word: "Word", file: "File" } as const;

/** The Applicant's Documents; each row opens in the viewer, and Previous/next moves across this list. */
export function DocumentList({ documents, label = "Documents", note, className }: { documents: ViewableDocument[]; label?: string; note?: string; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <ul aria-label={label} className={cn("grid gap-3", className)}>
        {documents.map((document, i) => (
          <li key={document.id}>
            <button
              type="button"
              aria-label={`Open ${document.name}`}
              onClick={() => setIndex(i)}
              className="flex w-full items-center gap-3.5 border border-line px-5 py-4 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
                <FileText className="size-[18px]" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium tracking-[0.35px] text-ink">{document.name}</span>
                <span className="block text-xs tracking-[0.35px] text-muted">
                  {kindLabel[documentKind(document)]} · {documentSize(document.size)}{note ? ` · ${note}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <DocumentViewer documents={documents} index={index} onIndexChange={setIndex} />
    </>
  );
}
