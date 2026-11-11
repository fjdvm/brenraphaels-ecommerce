"use client";

import { useState } from "react";

import type { UploadTransport } from "@/lib/careers/upload-transport";
import { UploadDocumentDialog } from "./upload-document-dialog";

/** The row's Upload button; it opens the upload dialog for that requested Document. */
export function UploadDocumentButton({ documentName, hint, dueLabel, transport }: { documentName: string; hint?: string | null; dueLabel?: string | null; transport?: UploadTransport }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Upload ${documentName}`}
        onClick={() => setOpen(true)}
        className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] text-primary"
      >
        Upload
      </button>
      <UploadDocumentDialog open={open} onOpenChange={setOpen} documentName={documentName} hint={hint} dueLabel={dueLabel} transport={transport} />
    </>
  );
}
