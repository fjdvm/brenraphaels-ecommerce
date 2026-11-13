"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Camera, ChevronRight, Eye, FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { submitApplicantDocument, type DocumentUploadOptions, type DocumentUploadResult } from "@/app/(careers)/careers/(portal)/profile/document-upload";
import { documentUploadedMessage, formatMegabytes, progressLabel, xhrTransport, type UploadProgress, type UploadTransport } from "@/lib/careers/upload-transport";
import { DOCUMENT_ACCEPT, DOCUMENT_FORMATS, DOCUMENT_MAX_SIZE_MB, documentFileProblem } from "@/lib/validators/document";
import { cn } from "@/lib/utils";
import { runWithToast } from "./action-toast";

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The requested Document, e.g. "NBI clearance". */
  documentName: string;
  /** e.g. "13 Nov"; omitted when no due date is known. */
  dueLabel?: string | null;
  /** e.g. "Not older than 6 months". */
  hint?: string | null;
  /** Called once the Document is stored and confirmed. */
  onUploaded?: () => void;
  /** Stores and records the chosen file; the profile upload by default, or an Offer document upload for a Document HR requested. */
  upload?: (formData: FormData, options: DocumentUploadOptions) => Promise<DocumentUploadResult>;
  /** Fakeable in tests; the real one reports bytes with XMLHttpRequest. */
  transport?: UploadTransport;
};

const smallButton = "rounded-full px-[22px] py-2.5 text-sm font-medium tracking-[0.45px] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

export function UploadDocumentDialog({ open, onOpenChange, documentName, dueLabel, hint, onUploaded, upload, transport = xhrTransport }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const browse = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  function choose(next: File | undefined) {
    if (!next || uploading) return;
    const refusal = documentFileProblem(next);
    setProblem(refusal);
    setProgress(null);
    setFile(refusal ? null : next);
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    choose(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function reset() {
    setFile(null);
    setProblem(null);
    setProgress(null);
  }

  function close(next: boolean) {
    if (!next) {
      abort.current?.abort();
      reset();
    }
    onOpenChange(next);
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    choose(event.dataTransfer.files[0]);
  }

  /** Runs behind the shared card too: it shows the same percentage, then the result. */
  async function submit() {
    if (!file || uploading) return;
    const chosen = file;
    const outcome = await runWithToast({
      loading: "Uploading…",
      success: "Document uploaded",
      error: "We couldn't upload that Document. Try again.",
      task: async (report) => {
        const controller = new AbortController();
        abort.current = controller;
        setUploading(true);
        setProblem(null);
        setProgress({ loaded: 0, total: chosen.size });
        const form = new FormData();
        form.set("document", chosen);
        const options: DocumentUploadOptions = {
          transport,
          signal: controller.signal,
          onProgress: (next) => {
            setProgress(next);
            report(progressLabel(next).percent);
          },
        };
        let result: DocumentUploadResult;
        try {
          result = await (upload ? upload(form, options) : submitApplicantDocument({}, form, options));
        } finally {
          setUploading(false);
          abort.current = null;
        }
        if (result.message === documentUploadedMessage) return { ok: true };
        if (result.cancelled) {
          setProgress(null);
          return { ok: false, message: "", cancelled: true };
        }
        setProblem(result.message ?? "We couldn't upload that Document. Try again.");
        return { ok: false, message: result.message ?? "" };
      },
    });
    if (outcome.ok) {
      reset();
      onUploaded?.();
      onOpenChange(false);
    }
  }

  const label = progress ? progressLabel(progress) : null;
  const failed = Boolean(file && problem && !uploading);
  const details = [dueLabel ? `Due ${dueLabel}` : null, hint, `${DOCUMENT_FORMATS} up to ${DOCUMENT_MAX_SIZE_MB} MB`].filter(Boolean);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(43,27,69,0.5)] sm:bg-[rgba(43,27,69,0.55)]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col overflow-y-auto bg-white shadow-[0_-8px_16px_rgba(43,26,69,0.2)] focus:outline-none",
            "inset-x-0 bottom-0 pb-6",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[600px] sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:pb-0 sm:shadow-[0_20px_24px_rgba(43,26,69,0.25)]",
          )}
        >
          <span aria-hidden className="mx-auto mt-2.5 mb-1 h-1 w-10 bg-line sm:hidden" />
          <div className="flex items-start gap-3 py-2.5 pl-5 pr-4 sm:pb-4 sm:pl-8 sm:pr-6 sm:pt-7">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <DialogPrimitive.Title className="font-serif text-[22px] leading-[1.3] text-primary">Upload {documentName}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="hidden text-sm tracking-[0.35px] text-body sm:block">{details.join(" · ")}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label="Close" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-primary sm:size-10">
              <X aria-hidden className="size-4 sm:size-[18px]" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-3.5 px-5 pb-4 pt-2 sm:gap-4 sm:px-8 sm:pb-6">
            <p className="text-xs tracking-[0.35px] text-muted sm:hidden">{[...details.slice(0, -1), `up to ${DOCUMENT_MAX_SIZE_MB} MB`].join(" · ")}</p>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={drop}
              className="hidden cursor-pointer flex-col items-center gap-2.5 border border-dashed border-accent bg-lavender-soft px-6 py-8 focus-within:ring-2 focus-within:ring-primary sm:flex"
            >
              <span aria-hidden className="flex size-[52px] items-center justify-center rounded-full bg-white text-primary"><Upload className="size-[22px]" /></span>
              <span className="text-sm font-medium tracking-[0.35px] text-primary">Drop your file here, or browse</span>
              <span className="text-xs tracking-[0.35px] text-muted">You can also take a clear photo with your phone</span>
              <input
                ref={browse}
                type="file"
                name="document"
                aria-label="Choose a file"
                accept={DOCUMENT_ACCEPT}
                disabled={uploading}
                onChange={pick}
                className="sr-only"
              />
            </label>

            {!file ? (
              <div className="flex flex-col gap-3.5 sm:hidden">
                <SheetOption icon={<Camera className="size-[18px]" />} title="Take a photo" hint="Use your camera. Make sure it’s clear and readable" onClick={() => camera.current?.click()} />
                <SheetOption icon={<ImageIcon className="size-[18px]" />} title="Choose from gallery" hint="Pick a photo you already took" onClick={() => browse.current?.click()} />
                <SheetOption icon={<FileText className="size-[18px]" />} title="Upload a file" hint={`${DOCUMENT_FORMATS} from your phone`} onClick={() => browse.current?.click()} />
                <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" aria-label="Take a photo" onChange={pick} className="sr-only" />
              </div>
            ) : null}

            {problem && !file ? <p role="alert" className="text-sm tracking-[0.35px] text-red-700">{problem}</p> : null}

            {file ? (
              <div className="flex flex-col gap-2.5 border border-line py-3.5 pl-3.5 pr-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex h-10 w-9 shrink-0 items-center justify-center bg-lavender-soft text-primary"><FileText className="size-4" /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 tracking-[0.35px]">
                    <span className="truncate text-sm font-medium text-ink">{file.name}</span>
                    <span className="text-xs text-muted">{label ? label.text : formatMegabytes(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={uploading ? "Cancel upload" : "Remove file"}
                    onClick={() => (uploading ? abort.current?.abort() : reset())}
                    className="shrink-0 text-muted hover:text-primary"
                  >
                    <X aria-hidden className="size-[18px]" />
                  </button>
                </div>
                {label ? (
                  <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={label.percent} className="h-1.5 overflow-hidden bg-lavender">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${label.percent}%` }} />
                  </div>
                ) : null}
                {failed ? <p role="alert" className="text-xs tracking-[0.35px] text-red-700">{problem}</p> : null}
              </div>
            ) : null}

            <p className="flex items-start gap-2.5 bg-surface-soft px-3.5 py-3 text-xs tracking-[0.35px] text-body">
              <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
              Make sure your name, photo and the issue date are readable. Blurry files may be sent back.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-line px-5 pt-[18px] sm:px-8 sm:pb-6">
            <p className="hidden flex-1 text-xs tracking-[0.35px] text-muted sm:block">Our team checks it within 1 working day.</p>
            <button type="button" onClick={() => close(false)} className={cn(smallButton, "border border-primary text-primary")}>Cancel</button>
            <button type="button" disabled={!file || uploading} onClick={() => void submit()} className={cn(smallButton, "bg-primary text-white")}>
              {uploading ? "Uploading…" : failed ? "Retry" : "Submit document"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SheetOption({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3.5 border border-line p-3.5 text-left tracking-[0.35px]">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  );
}
