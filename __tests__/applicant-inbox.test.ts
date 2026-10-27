import { beforeEach, expect, test, vi } from "vitest";

const { careersSession } = vi.hoisted(() => ({ careersSession: vi.fn() }));
vi.mock("@/lib/careers/auth", () => ({ careersSession }));

import { listApplicantInbox, unreadApplicantInboxCount, markApplicantInboxRead, markAllApplicantInboxRead } from "@/lib/careers/inbox";

const gateway = (fetch: typeof globalThis.fetch) => ({ baseUrl: "https://gateway.test/", callerKey: "careers-key", fetch });
const first = "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a10";
const stored = {
  id: first, type: "job-posting.opened", title: "New Job Posting: Baker",
  body: "Applications are open for Baker.", link: "https://shop.test/careers/baker",
  sendingApp: "hrms", targetApp: "careers", userId: "applicant-1",
  createdAt: "2026-10-26T06:00:00.000Z", readAt: null,
};
beforeEach(() => { careersSession.mockResolvedValue({ userId: "applicant-1" }); });

test("lists the signed-in Applicant's Careers Notifications newest first", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ notifications: [stored], nextCursor: null }));
  expect(await listApplicantInbox(gateway(fetch))).toEqual([{
    id: first, type: "job-posting.opened", title: "New Job Posting: Baker",
    body: "Applications are open for Baker.", link: "https://shop.test/careers/baker",
    createdAt: new Date("2026-10-26T06:00:00.000Z"), readAt: null,
  }]);
  expect(fetch).toHaveBeenCalledWith(
    "https://gateway.test/notifications/notifications?userId=applicant-1&app=careers&limit=50",
    expect.objectContaining({ headers: { Authorization: "Bearer careers-key" } }),
  );
});

test("counts the signed-in Applicant's unread Careers Notifications", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ unread: 2 }));
  expect(await unreadApplicantInboxCount(gateway(fetch))).toBe(2);
  expect(fetch).toHaveBeenCalledWith(
    "https://gateway.test/notifications/notifications/unread-count?userId=applicant-1&app=careers",
    expect.objectContaining({ headers: { Authorization: "Bearer careers-key" } }),
  );
});

test("marks one Careers Notification read for the signed-in Applicant", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: first, read: true }));
  await markApplicantInboxRead(first, gateway(fetch));
  expect(fetch).toHaveBeenCalledWith(`https://gateway.test/notifications/notifications/${first}/read`, expect.objectContaining({
    method: "POST", body: JSON.stringify({ userId: "applicant-1", app: "careers" }),
  }));
});

test("marks all Careers Notifications read for the signed-in Applicant", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ updated: 2 }));
  await markAllApplicantInboxRead(gateway(fetch));
  expect(fetch).toHaveBeenCalledWith("https://gateway.test/notifications/notifications/read-all", expect.objectContaining({
    method: "POST", body: JSON.stringify({ userId: "applicant-1", app: "careers" }),
  }));
});

function fakeGateway() {
  const rows: (Omit<typeof stored, "readAt"> & { readAt: string | null })[] = [
    { ...stored, id: "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a11", createdAt: "2026-10-25T06:00:00.000Z" },
    { ...stored },
    { ...stored, id: "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a12", userId: "applicant-2" },
    { ...stored, id: "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a13", targetApp: "ecommerce" },
  ];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (new Headers(init?.headers).get("Authorization") !== "Bearer careers-key") return new Response(null, { status: 401 });
    const scope = init?.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams);
    const own = rows.filter((row) => row.userId === scope.userId && row.targetApp === scope.app);
    if (url.pathname.endsWith("/unread-count")) return Response.json({ unread: own.filter((row) => !row.readAt).length });
    if (url.pathname.endsWith("/read-all")) {
      for (const row of own) row.readAt = "2026-10-27T06:00:00.000Z";
      return Response.json({ updated: own.length });
    }
    if (url.pathname.endsWith("/read")) {
      const row = own.find((row) => row.id === url.pathname.split("/").at(-2));
      if (!row) return new Response(null, { status: 404 });
      row.readAt = "2026-10-27T06:00:00.000Z";
      return Response.json({ id: row.id, read: true });
    }
    return Response.json({ notifications: own.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), nextCursor: null });
  };
  return gateway(fetch);
}

test("Applicants only see and change their own Careers inbox, including mark all", async () => {
  const service = fakeGateway();
  expect((await listApplicantInbox(service)).map((row) => row.id)).toEqual([
    first, "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a11",
  ]);
  expect(await unreadApplicantInboxCount(service)).toBe(2);
  await expect(markApplicantInboxRead("5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a12", service)).rejects.toThrow("404");
  await expect(markApplicantInboxRead("5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a13", service)).rejects.toThrow("404");
  await markApplicantInboxRead(first, service);
  expect(await unreadApplicantInboxCount(service)).toBe(1);
  await markAllApplicantInboxRead(service);
  expect(await unreadApplicantInboxCount(service)).toBe(0);
  expect((await listApplicantInbox(service)).every((row) => row.readAt instanceof Date)).toBe(true);
  careersSession.mockResolvedValue({ userId: "applicant-2" });
  expect(await unreadApplicantInboxCount(service)).toBe(1);
  expect((await listApplicantInbox(service)).map((row) => row.id)).toEqual(["5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a12"]);
  await expect(markApplicantInboxRead(first, service)).rejects.toThrow("404");
});

test("signed-out requests cannot list, count or change Notifications", async () => {
  careersSession.mockResolvedValue(null);
  const fetch = vi.fn();
  const service = gateway(fetch);
  for (const operation of [() => listApplicantInbox(service), () => unreadApplicantInboxCount(service),
    () => markApplicantInboxRead(first, service), () => markAllApplicantInboxRead(service)]) {
    await expect(operation()).rejects.toThrow("Please sign in");
  }
  expect(fetch).not.toHaveBeenCalled();
});

test("rejects malformed Notification ids before making an HTTP request", async () => {
  const fetch = vi.fn();
  await expect(markApplicantInboxRead("../read-all", gateway(fetch))).rejects.toThrow("Not a Notification id");
  expect(fetch).not.toHaveBeenCalled();
});

test("empty inboxes return an empty list and zero unread", async () => {
  const service = fakeGateway();
  careersSession.mockResolvedValue({ userId: "no-notifications" });
  expect(await listApplicantInbox(service)).toEqual([]);
  expect(await unreadApplicantInboxCount(service)).toBe(0);
  await markAllApplicantInboxRead(service);
});

test("gateway failures propagate so the caller can show a retry", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 502 }));
  const service = gateway(fetch);
  for (const operation of [() => listApplicantInbox(service), () => unreadApplicantInboxCount(service),
    () => markApplicantInboxRead(first, service), () => markAllApplicantInboxRead(service)]) {
    await expect(operation()).rejects.toThrow("502");
  }
});

test("uses the dedicated Careers credential by default and never falls back to the storefront key", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ notifications: [], nextCursor: null }));
  vi.stubEnv("CAREERS_API_GATEWAY_CALLER_KEY", "careers-key");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test/");
  try {
    await listApplicantInbox({ fetch });
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: { Authorization: "Bearer careers-key" },
    }));
    vi.stubEnv("CAREERS_API_GATEWAY_CALLER_KEY", "");
    fetch.mockClear();
    await expect(listApplicantInbox({ fetch })).rejects.toThrow("CAREERS_API_GATEWAY_CALLER_KEY");
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.unstubAllEnvs(); }
});

test("issues the signed-in Applicant's own live Notifications address", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ticket: "t 1" }));
  const { liveApplicantInboxUrl } = await import("@/lib/careers/inbox");
  expect(await liveApplicantInboxUrl(gateway(fetch))).toBe("wss://gateway.test/notifications/live?ticket=t%201");
  expect(fetch).toHaveBeenCalledWith(
    "https://gateway.test/live-tickets",
    expect.objectContaining({ body: JSON.stringify({ userId: "applicant-1" }), headers: expect.objectContaining({ Authorization: "Bearer careers-key" }) }),
  );
});

test("refuses a live address when no Applicant is signed in", async () => {
  careersSession.mockResolvedValue(null);
  const fetch = vi.fn();
  const { liveApplicantInboxUrl } = await import("@/lib/careers/inbox");
  await expect(liveApplicantInboxUrl(gateway(fetch))).rejects.toThrow("sign in");
  expect(fetch).not.toHaveBeenCalled();
});
