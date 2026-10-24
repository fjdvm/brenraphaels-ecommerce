export const evidenceRoles = ["photo", "video"] as const;
export type EvidenceRole = (typeof evidenceRoles)[number];
export const evidenceLimits = { photo: 5 * 1024 * 1024, video: 25 * 1024 * 1024 };
export const evidenceTypes = { photo: ["image/jpeg", "image/png"], video: ["video/mp4", "video/quicktime"] };
export const maxPhotos = 3;

/** Browser-side pre-check so a wrong or oversized file is refused before it uploads. The server re-checks real bytes. */
export function evidenceFileError(file: { type: string; size: number }, role: EvidenceRole): string | undefined {
  if (!evidenceTypes[role].includes(file.type)) {
    return role === "photo" ? "Photos must be JPG or PNG." : "Videos must be MP4 or MOV.";
  }
  if (file.size === 0) return role === "photo" ? "This photo is empty." : "This video is empty.";
  if (file.size > evidenceLimits[role]) {
    return role === "photo" ? "Photos must be 5 MB or smaller." : "Videos must be 25 MB or smaller.";
  }
  return undefined;
}
