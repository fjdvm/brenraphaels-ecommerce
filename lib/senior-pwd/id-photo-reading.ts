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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return undefined;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : undefined;
}

/**
 * The expiry date in recognised text, as `YYYY-MM-DD`: the first date after a "valid until", "expiry date" or similar
 * label, in the forms Philippine IDs print (15 Mar 2027, 2027-03-15, 15/03/2027). Undefined when none is printed, which
 * is normal for IDs that never expire. Only a suggestion: the Customer confirms or corrects it.
 */
export function findIdExpiry(text: string): string | undefined {
  const label = /(?:valid\s+until|valid\s+thru|expir\w*|expiry\s+date)\s*[:.\-]?\s*([^\n]+)/i.exec(text);
  if (!label) return undefined;
  const rest = label[1];
  const named = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(rest);
  if (named) {
    const month = MONTHS.indexOf(named[2].toLowerCase()) + 1;
    return month ? isoDate(+named[3], month, +named[1]) : undefined;
  }
  const year = /(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(rest);
  if (year) return isoDate(+year[1], +year[2], +year[3]);
  const day = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(rest);
  return day ? isoDate(+day[3], +day[2], +day[1]) : undefined;
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
