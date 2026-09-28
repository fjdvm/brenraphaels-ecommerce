import { z } from "zod";

import { multilineTextField, optionalTextField, textField, urlField } from "../validators/fields";

export const feedbackTitleMaximumLength = 120;
export const feedbackDescriptionMaximumLength = 2_000;
const feedbackEnvironmentValueMaximumLength = 1_000;
const feedbackHoneypotMaximumLength = 1_000;

const feedbackTextPattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\s]+$/u;
const feedbackTextPatternMessage = "Enter text without invisible characters";
// A hidden bot trap: real visitors never see or fill this field, so any content is accepted as-is.
const honeypotPattern = /^[\s\S]*$/;

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
  environment: z.object({
    pageUrl: urlField("Page URL", 2_000),
    screenSize: textField("Screen size", { min: 1, max: 40, pattern: /^\d{1,5} × \d{1,5}$/, patternMessage: "Enter a valid screen size" }),
    viewportSize: textField("Viewport size", { min: 1, max: 40, pattern: /^\d{1,5} × \d{1,5}$/, patternMessage: "Enter a valid viewport size" }),
    timestamp: textField("Timestamp", { min: 20, max: 40, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, patternMessage: "Enter a valid timestamp" }),
    consoleErrors: z.array(multilineTextField("Console error", {
      max: feedbackEnvironmentValueMaximumLength,
      pattern: feedbackTextPattern,
      patternMessage: feedbackTextPatternMessage,
    })).max(10, "Include at most 10 console errors"),
  }),
  // Left blank by real visitors; a filled value marks the submission as automated.
  honeypot: optionalTextField({
    max: feedbackHoneypotMaximumLength,
    pattern: honeypotPattern,
    patternMessage: "Enter a valid value",
  }),
});

export type FeedbackReport = z.output<typeof feedbackReportSchema>;

export type FeedbackEnvironment = FeedbackReport["environment"] & {
  browser: string;
  operatingSystem: string;
  deviceType: string;
  appEnvironment: string;
  appVersion: string;
  identity: string;
};

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

export function feedbackIssueBody(report: FeedbackReport, environment: FeedbackEnvironment) {
  const consoleErrors = environment.consoleErrors.length
    ? environment.consoleErrors.map((error) => `- ${error.replace(/\n/g, "\n  ")}`).join("\n")
    : "None";

  return [
    report.description,
    report.stepsToReproduce && `## Steps to reproduce\n\n${report.stepsToReproduce}`,
    report.expectedResult && `## Expected result\n\n${report.expectedResult}`,
    report.actualResult && `## Actual result\n\n${report.actualResult}`,
    [
      "<details>",
      "<summary>Environment</summary>",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| Page URL | ${markdownCell(environment.pageUrl)} |`,
      `| Browser | ${markdownCell(environment.browser)} |`,
      `| OS | ${markdownCell(environment.operatingSystem)} |`,
      `| Device type | ${markdownCell(environment.deviceType)} |`,
      `| Screen size | ${markdownCell(environment.screenSize)} |`,
      `| Viewport size | ${markdownCell(environment.viewportSize)} |`,
      `| Timestamp | ${markdownCell(environment.timestamp)} |`,
      `| App environment | ${markdownCell(environment.appEnvironment)} |`,
      `| App version | ${markdownCell(environment.appVersion)} |`,
      `| Signed-in identity | ${markdownCell(environment.identity)} |`,
      "",
      "#### Recent console errors",
      "",
      consoleErrors,
      "",
      "</details>",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
}
