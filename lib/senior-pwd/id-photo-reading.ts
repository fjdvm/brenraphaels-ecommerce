/**
 * Reads the ID number off a Senior Citizen or PWD ID photo in the browser, so the Customer only has to check it.
 * The image is never uploaded to read it, and the number read is only a suggestion: the Customer confirms or corrects it.
 */

const allowed = /^[A-Z0-9][A-Z0-9 -]*$/;

/** Keeps what the ID number field accepts: 4–30 letters, digits, spaces and hyphens, starting with a letter or digit. */
function clean(raw: string): string | null {
  const value = raw.toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s{2,}.*$/, "").trim().replace(/[ -]+$/, "");
  return value.length >= 4 && value.length <= 30 && allowed.test(value) && /\d/.test(value) ? value : null;
}

/**
 * The most likely ID number in recognised text. A labelled number ("OSCA ID No.", "PWD ID No.", "ID No.", "Control No.")
 * wins; otherwise the PWD format printed nationwide (RR-PPMM-BBB-NNNNNNN). Undefined when nothing looks like one.
 */
export function findIdNumber(text: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const labelled = /(?:osca|pwd|senior|control|id)\s*(?:id\s*)?(?:no|number|#)\s*[.:#-]*\s*([A-Z0-9][A-Z0-9 -]{3,40})/i.exec(line);
    const value = labelled ? clean(labelled[1]) : null;
    if (value) return value;
  }
  const pwd = /\b\d{2}-\d{4}-\d{3}-\d{7}\b/.exec(text);
  return pwd ? pwd[0] : undefined;
}

/** Runs the open-source OCR (Tesseract, WebAssembly) entirely in the browser; the image is never uploaded to read it. */
export async function readIdPhotoText(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
