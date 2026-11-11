"use client";

import { Download, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PhotoViewer, type PhotoViewerItem } from "@/components/ui/photo-viewer";
import { openApplicantDocumentLink } from "../(portal)/profile/actions";

export type ViewableDocument = { id: number; name: string; contentType: string; size: number };

const OPEN_FAILED = "We couldn't open that Document. Try again.";

type LinkState = { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string };

export function documentKind({ contentType }: Pick<ViewableDocument, "contentType">) {
  if (contentType.startsWith("image/")) return "image" as const;
  if (contentType === "application/pdf") return "pdf" as const;
  if (contentType === "application/msword" || contentType.includes("wordprocessingml")) return "word" as const;
  return "file" as const;
}

export function documentSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function Message({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 text-center text-sm tracking-[0.35px] text-white">
      <p>{children}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-primary hover:opacity-90">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function Stage({ document, link, retry }: { document: ViewableDocument; link: LinkState | undefined; retry: () => void }) {
  const [broken, setBroken] = useState(false);
  if (!link || link.status === "loading") return <p role="status" className="text-sm tracking-[0.35px] text-white">Opening {document.name}…</p>;
  if (link.status === "error") return <Message onRetry={retry}>{link.message}</Message>;
  const kind = documentKind(document);
  // The link is short-lived: a file that no longer loads gets a new link, not a dead page.
  if (broken && (kind === "image" || kind === "pdf")) return <Message onRetry={() => { setBroken(false); retry(); }}>{OPEN_FAILED}</Message>;
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- signed file-storage address, shown at its natural size
    return <img src={link.url} alt={document.name} onError={() => setBroken(true)} className="h-auto max-h-full w-auto max-w-full object-contain sm:rounded-[32px]" />;
  }
  if (kind === "pdf") {
    return <iframe src={link.url} title={document.name} className="size-full max-w-[1000px] bg-white sm:rounded-[32px]" />;
  }
  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[28px] bg-white p-8 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-lavender text-primary"><FileText className="size-6" strokeWidth={1.5} /></span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="break-words font-medium text-ink">{document.name}</p>
        <p className="text-xs text-muted">{kind === "word" ? "Word" : "File"} · {documentSize(document.size)}</p>
      </div>
      <a href={link.url} download={document.name} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90">
        <Download aria-hidden className="size-4" />Download
      </a>
    </div>
  );
}

/** Opens Documents in the shared viewer. A signed link is fetched on open and on Previous/next, never on a timer. */
export function DocumentViewer({ documents, index, onIndexChange }: { documents: ViewableDocument[]; index: number | null; onIndexChange: (index: number | null) => void }) {
  const [links, setLinks] = useState<Record<number, LinkState>>({});
  const requested = useRef(new Set<number>());
  const current = index === null ? undefined : documents[index];
  const currentId = current?.id;

  const load = useCallback(async (id: number) => {
    requested.current.add(id);
    setLinks((state) => ({ ...state, [id]: { status: "loading" } }));
    let next: LinkState;
    try {
      const result = await openApplicantDocumentLink(id);
      next = "url" in result ? { status: "ready", url: result.url } : { status: "error", message: result.message };
    } catch {
      next = { status: "error", message: OPEN_FAILED };
    }
    setLinks((state) => ({ ...state, [id]: next }));
  }, []);

  useEffect(() => {
    if (currentId !== undefined && !requested.current.has(currentId)) void load(currentId);
  }, [currentId, load]);

  function change(next: number | null) {
    if (next === null) {
      // Closed: the links are short-lived, so the next open asks again.
      requested.current.clear();
      setLinks({});
    }
    onIndexChange(next);
  }

  const items: PhotoViewerItem[] = documents.map((document) => ({
    key: String(document.id),
    caption: document.name,
    stage: document.id === currentId ? <Stage key={document.id} document={document} link={links[document.id]} retry={() => void load(document.id)} /> : null,
    thumbnail: <span aria-hidden className="flex size-full items-center justify-center bg-lavender text-primary"><FileText className="size-6" strokeWidth={1.5} /></span>,
  }));

  return <PhotoViewer label="Your Documents" noun="Document" items={items} index={index} onIndexChange={change} />;
}
