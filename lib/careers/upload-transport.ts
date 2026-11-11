/** Sends the bytes from the browser straight to file-storage and reports real progress. Never used on the server. */
export type UploadProgress = { loaded: number; total: number };
export type UploadTransport = (
  url: string,
  file: File,
  options: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal },
) => Promise<void>;

export class UploadCancelled extends Error {
  constructor() { super("Upload cancelled."); }
}
export const documentUploadedMessage = "Document uploaded.";
export const uploadFailedMessage = "We couldn't upload that Document. Try again.";

/** XMLHttpRequest is used because `fetch` cannot report upload progress. */
export const xhrTransport: UploadTransport = (url, file, { onProgress, signal }) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadCancelled());
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total });
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size });
        resolve();
      } else reject(new Error(uploadFailedMessage));
    };
    request.onerror = () => reject(new Error(uploadFailedMessage));
    request.ontimeout = () => reject(new Error(uploadFailedMessage));
    request.onabort = () => reject(new UploadCancelled());
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });

/** Default transport: no progress, same result. */
export const fetchTransport: UploadTransport = async (url, file, { signal }) => {
  const response = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal });
  if (!response.ok) throw new Error(uploadFailedMessage);
};

export function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
/** "1.8 MB of 2.8 MB · 64%" */
export function progressLabel({ loaded, total }: UploadProgress) {
  const percent = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;
  return { percent, text: `${formatMegabytes(loaded)} of ${formatMegabytes(total)} · ${percent}%` };
}
