import { textField } from "./fields";

/** An opaque storage reference, never a URL or an authorization token. */
export const fileIdField = textField("File id", {
  min: 1,
  max: 256,
  pattern: /^[A-Za-z0-9_-]+$/,
  patternMessage: "File id can only contain letters, digits, hyphens and underscores",
  rejectInvisible: true,
});
