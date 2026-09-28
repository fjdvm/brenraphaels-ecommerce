import { z } from "zod";

import { feedbackIssueBody, feedbackReportSchema } from "@/lib/feedback/report";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ message: "Please submit a valid feedback form." }, { status: 400 });
  }

  const parsed = feedbackReportSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repository = process.env.GITHUB_FEEDBACK_REPOSITORY;
  if (!token || !repository) {
    console.error("Feedback GitHub configuration is missing");
    return Response.json({ message: "We couldn't submit your feedback. Please try again later." }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        title: parsed.data.title,
        body: feedbackIssueBody(parsed.data),
        labels: ["feedback"],
      }),
    });
    if (!response.ok) {
      console.error("Feedback GitHub issue creation failed", response.status);
      return Response.json({ message: "We couldn't submit your feedback. Please try again later." }, { status: 502 });
    }
  } catch (error) {
    console.error("Feedback GitHub issue creation failed", error);
    return Response.json({ message: "We couldn't submit your feedback. Please try again later." }, { status: 502 });
  }

  return Response.json({ success: true }, { status: 201 });
}
