import { afterEach, describe, expect, test, vi } from "vitest";

import { POST } from "../app/api/feedback/route";

const validReport = {
  title: "The product page is hard to read",
  description: "The price text blends into the background.\nPlease increase the contrast.",
  stepsToReproduce: "1. Open a product\n2. Scroll to the price",
  expectedResult: "The price is easy to read.",
  actualResult: "The price has low contrast.",
};

function request(body: unknown) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/feedback", () => {
  test("creates a labelled GitHub issue from a valid report", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);

    const response = await POST(request(validReport));

    expect(response.status).toBe(201);
    expect(github).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repository/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          title: validReport.title,
          body: [
            validReport.description,
            "## Steps to reproduce\n\n1. Open a product\n2. Scroll to the price",
            "## Expected result\n\nThe price is easy to read.",
            "## Actual result\n\nThe price has low contrast.",
          ].join("\n\n"),
          labels: ["feedback"],
        }),
      }),
    );
  });

  test("accepts a description at its 2,000-character limit", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);

    const response = await POST(request({ ...validReport, description: "a".repeat(2_000) }));

    expect(response.status).toBe(201);
    expect(github).toHaveBeenCalledOnce();
  });

  test("preserves consecutive blank lines in the GitHub issue body", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);
    const description = "The first paragraph.\n\n\n\nThe second paragraph.";

    const response = await POST(request({ ...validReport, description }));

    expect(response.status).toBe(201);
    expect(JSON.parse(github.mock.calls[0][1].body).body).toContain(description);
  });

  test("rejects invisible characters instead of silently removing them", async () => {
    const github = vi.fn();
    vi.stubGlobal("fetch", github);

    const response = await POST(request({ ...validReport, description: "A\u200Bhidden character" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ fieldErrors: { description: expect.any(Array) } });
    expect(github).not.toHaveBeenCalled();
  });

  test.each([
    ["a missing title", { title: "" }, "title"],
    ["a missing description", { description: "" }, "description"],
    ["an over-length title", { title: "a".repeat(121) }, "title"],
    ["an over-length description", { description: "a".repeat(2_001) }, "description"],
    ["over-length steps", { stepsToReproduce: "a".repeat(2_001) }, "stepsToReproduce"],
    ["an over-length expected result", { expectedResult: "a".repeat(2_001) }, "expectedResult"],
    ["an over-length actual result", { actualResult: "a".repeat(2_001) }, "actualResult"],
  ])("rejects %s", async (_label, change, field) => {
    const github = vi.fn();
    vi.stubGlobal("fetch", github);

    const response = await POST(request({ ...validReport, ...change }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ fieldErrors: { [field]: expect.any(Array) } });
    expect(github).not.toHaveBeenCalled();
  });
});
