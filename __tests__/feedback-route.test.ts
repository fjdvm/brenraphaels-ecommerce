import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sessions = vi.hoisted(() => ({
  storefront: vi.fn(),
  applicant: vi.fn(),
}));
const database = vi.hoisted(() => ({ getDatabase: vi.fn() }));

vi.mock("@/lib/neon-auth/server", () => ({ getVisitorSession: sessions.storefront }));
vi.mock("@/lib/careers/auth", () => ({ careersSession: sessions.applicant }));
vi.mock("@/lib/db", () => ({ getDatabase: database.getDatabase }));

import { POST } from "../app/api/feedback/route";

const validReport = {
  title: "The product page is hard to read",
  description: "The price text blends into the background.\nPlease increase the contrast.",
  stepsToReproduce: "1. Open a product\n2. Scroll to the price",
  expectedResult: "The price is easy to read.",
  actualResult: "The price has low contrast.",
  environment: {
    pageUrl: "https://shop.example/products/ube-jam",
    screenSize: "1440 × 900",
    viewportSize: "1280 × 720",
    timestamp: "2026-09-28T10:20:30.000Z",
    consoleErrors: ["Failed to load product image"],
  },
};

const defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36";

function request(body: unknown, userAgent = defaultUserAgent, ip = "203.0.113.10") {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function stubGithub() {
  vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
  vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
  const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", github);
  return github;
}

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  database.getDatabase.mockReturnValue(drizzle(client));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  sessions.storefront.mockReset();
  sessions.applicant.mockReset();
  sessions.storefront.mockResolvedValue(null);
  sessions.applicant.mockResolvedValue(null);
  database.getDatabase.mockReset();
  await client.close();
});

describe("POST /api/feedback", () => {
  test("creates a labelled GitHub issue from a valid report", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
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
        body: expect.any(String),
      }),
    );
    const body = JSON.parse(github.mock.calls[0][1].body).body;
    expect(body).toContain("<summary>Environment</summary>");
    expect(body).toContain("| Browser | Chrome 140.0.0.0 |");
    expect(body).toContain("| OS | macOS 14.6 |");
    expect(body).toContain("| Signed-in identity | anonymous |");
    expect(body).toContain("| App version | abc123 |");
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

  test("records the authenticated storefront user identifier", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    sessions.storefront.mockResolvedValue({ userId: "storefront-user", email: "private@example.com", fullName: "Private Person" });
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);

    await POST(request(validReport));

    expect(JSON.parse(github.mock.calls[0][1].body).body).toContain("| Signed-in identity | storefront-user |");
    expect(JSON.parse(github.mock.calls[0][1].body).body).not.toContain("private@example.com");
    expect(sessions.applicant).not.toHaveBeenCalled();
  });

  test("records the authenticated applicant identifier when no storefront session exists", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    sessions.storefront.mockResolvedValue(null);
    sessions.applicant.mockResolvedValue({ userId: "applicant-user", email: "private@example.com", fullName: "Private Person" });
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);

    await POST(request(validReport));

    expect(JSON.parse(github.mock.calls[0][1].body).body).toContain("| Signed-in identity | applicant-user |");
  });

  test("ignores a forged client identity", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    vi.stubEnv("GITHUB_FEEDBACK_REPOSITORY", "owner/repository");
    sessions.storefront.mockResolvedValue({ userId: "storefront-user", email: "private@example.com", fullName: "Private Person" });
    const github = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", github);

    await POST(request({ ...validReport, identity: "forged-admin" }));

    const body = JSON.parse(github.mock.calls[0][1].body).body;
    expect(body).toContain("| Signed-in identity | storefront-user |");
    expect(body).not.toContain("forged-admin");
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

describe("POST /api/feedback rate limiting", () => {
  test("allows five successive submissions from the same IP", async () => {
    const github = stubGithub();

    for (let submission = 0; submission < 5; submission += 1) {
      const response = await POST(request(validReport));
      expect(response.status).toBe(201);
    }
    expect(github).toHaveBeenCalledTimes(5);
  });

  test("rejects a sixth submission from the same IP within the window", async () => {
    const github = stubGithub();

    for (let submission = 0; submission < 5; submission += 1) {
      await POST(request(validReport));
    }
    github.mockClear();

    const response = await POST(request(validReport));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ rateLimited: true });
    expect(github).not.toHaveBeenCalled();
  });

  test("does not rate-limit submissions from a different IP address", async () => {
    const github = stubGithub();

    for (let submission = 0; submission < 5; submission += 1) {
      await POST(request(validReport, defaultUserAgent, "203.0.113.10"));
    }

    const response = await POST(request(validReport, defaultUserAgent, "203.0.113.20"));

    expect(response.status).toBe(201);
    expect(github).toHaveBeenCalledTimes(6);
  });

  test("frees a slot as each old submission ages out, instead of resetting all at once", async () => {
    const github = stubGithub();
    const start = new Date("2026-09-28T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);

    for (let submission = 0; submission < 5; submission += 1) {
      vi.setSystemTime(new Date(start.getTime() + submission * 60_000));
      const response = await POST(request(validReport));
      expect(response.status).toBe(201);
    }

    // Still within 30 minutes of the first submission: the window has not rolled yet.
    vi.setSystemTime(new Date(start.getTime() + 29 * 60_000));
    const stillLimited = await POST(request(validReport));
    expect(stillLimited.status).toBe(429);

    // Just past 30 minutes after the first submission, only it ages out, freeing one slot.
    vi.setSystemTime(new Date(start.getTime() + 30 * 60_000 + 1_000));
    const allowedAgain = await POST(request(validReport));
    expect(allowedAgain.status).toBe(201);
    expect(github).toHaveBeenCalledTimes(6);
  });
});

describe("POST /api/feedback honeypot", () => {
  test("drops a submission with a filled honeypot without creating an issue", async () => {
    const github = stubGithub();

    const response = await POST(request({ ...validReport, honeypot: "I am a bot" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(github).not.toHaveBeenCalled();
  });
});
