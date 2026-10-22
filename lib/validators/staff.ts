import { z } from "zod";

import { personNameCharacterPattern, personNameCharacterPatternMessage, textField } from "./fields";

/** Staff identity belongs to CREOMS; retain an opaque id and a display-name snapshot. */
export const staffAttribution = z.object({
  staffId: textField("Staff id", {
    min: 1,
    max: 256,
    pattern: /^[^\s<>]+$/u,
    patternMessage: "Staff id cannot contain whitespace or angle brackets",
    rejectInvisible: true,
  }),
  staffName: textField("Staff name", {
    min: 1,
    max: 256,
    pattern: personNameCharacterPattern,
    patternMessage: personNameCharacterPatternMessage,
    rejectInvisible: true,
  }),
});
