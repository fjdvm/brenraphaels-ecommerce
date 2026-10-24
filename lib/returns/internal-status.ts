import { z } from "zod";

import { staffAttribution } from "../validators/staff";
import { returnDecisionSchema } from "./returns";

const [approval, received, refund, replacement, decline] = returnDecisionSchema.options;
const staffDecisionSchema = z.discriminatedUnion("status", [
  approval.extend(staffAttribution.shape), received.extend(staffAttribution.shape),
  refund.extend(staffAttribution.shape), replacement.extend(staffAttribution.shape),
  decline.extend(staffAttribution.shape),
]);

export function parseInternalReturnStatusUpdate(input: unknown) {
  const { staffId, staffName, ...decision } = staffDecisionSchema.parse(input);
  return { actor: { type: "staff" as const, id: staffId, name: staffName }, decision };
}
