import { z } from "zod";

import { multilineTextField, textField } from "../validators/fields";

export const feedbackTitleMaximumLength = 120;
export const feedbackDescriptionMaximumLength = 2_000;

const feedbackTextPattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\s]+$/u;
const feedbackTextPatternMessage = "Enter text without invisible characters";

export const feedbackReportSchema = z.object({
  title: textField("Title", {
    min: 1,
    max: feedbackTitleMaximumLength,
    pattern: feedbackTextPattern,
    patternMessage: feedbackTextPatternMessage,
  }),
  description: multilineTextField("Description", {
    max: feedbackDescriptionMaximumLength,
    pattern: feedbackTextPattern,
    patternMessage: feedbackTextPatternMessage,
  }),
  stepsToReproduce: multilineTextField("Steps to reproduce", {
    max: feedbackDescriptionMaximumLength,
    optional: true,
    pattern: feedbackTextPattern,
    patternMessage: feedbackTextPatternMessage,
  }),
  expectedResult: multilineTextField("Expected result", {
    max: feedbackDescriptionMaximumLength,
    optional: true,
    pattern: feedbackTextPattern,
    patternMessage: feedbackTextPatternMessage,
  }),
  actualResult: multilineTextField("Actual result", {
    max: feedbackDescriptionMaximumLength,
    optional: true,
    pattern: feedbackTextPattern,
    patternMessage: feedbackTextPatternMessage,
  }),
});

export type FeedbackReport = z.output<typeof feedbackReportSchema>;

export function feedbackIssueBody(report: FeedbackReport) {
  return [
    report.description,
    report.stepsToReproduce && `## Steps to reproduce\n\n${report.stepsToReproduce}`,
    report.expectedResult && `## Expected result\n\n${report.expectedResult}`,
    report.actualResult && `## Actual result\n\n${report.actualResult}`,
  ].filter(Boolean).join("\n\n");
}
