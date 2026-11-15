// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ markOrderReceived: vi.fn(), submitOrderFeedback: vi.fn() }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order } from "@/lib/orders/orders";
import type { ReturnOffer } from "@/lib/returns/return-offers";

const now = Date.parse("2026-10-24T12:00:00Z");
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const order: Order = {
  id: 7, fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", status: "delivered", subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: null, createdAt: new Date("2026-10-10T06:00:00Z"), lines: [], deliveryAddress: null,
  paymentProof: null, paidById: null, paidByName: null, paidAt: null, deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null,
};
const line = (id: number, returnable = true) => ({ id, productName: `Item ${id}`, sizeLabel: "Small", quantity: 1, priceInCentavos: 10_000, imageUrl: null, returnable });
const offer = (patch: Partial<ReturnOffer> = {}): ReturnOffer => ({
  deliveredAtMs: now - 60 * 60_000, windowExtended: false, lines: [line(1), line(2), line(3, false)], requested: null, ...patch,
});
const renderOrder = (returnOffer: ReturnOffer | null, returnInProgress = false) =>
  render(<OrdersBrowser orders={[{ order, feedback: null, returnInProgress, returnOffer }]} />);

const photo = new File(["x"], "defect.png", { type: "image/png" });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("Return button", () => {
  test("shows with the time left on an eligible Order", async () => {
    renderOrder(offer());
    expect(await screen.findByRole("button", { name: "Return items" })).toBeTruthy();
    expect(screen.getByText("23h 0m left")).toBeTruthy();
  });

  test("shows Return window closed instead once 24 hours have passed", async () => {
    renderOrder(offer({ deliveredAtMs: now - 25 * 3_600_000 }));
    expect(await screen.findByText("Return window closed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Return items" })).toBeNull();
  });

  test("is absent without an offer, or when every item is already in a Return", () => {
    renderOrder(null);
    expect(screen.queryByRole("button", { name: "Return items" })).toBeNull();
    cleanup();
    renderOrder(offer({ lines: [line(3, false)] }));
    expect(screen.queryByRole("button", { name: "Return items" })).toBeNull();
  });
});

describe("Return form", () => {
  async function open() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, applyAccept: false });
    renderOrder(offer());
    await user.click(await screen.findByRole("button", { name: "Return items" }));
    return { user, dialog: await screen.findByRole("dialog") };
  }

  test("lists whole items and disables ones already in a Return", async () => {
    const { dialog } = await open();
    expect((within(dialog).getByRole("checkbox", { name: /Item 1/ }) as HTMLInputElement).disabled).toBe(false);
    expect((within(dialog).getByRole("checkbox", { name: /Item 3/ }) as HTMLInputElement).disabled).toBe(true);
  });

  test("names every missing field and sends nothing", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    const alerts = within(dialog).getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts).toEqual(expect.arrayContaining([
      "Choose at least one item to return.", "Choose a reason.", "Attach one to three photos.", "Choose a refund or a replacement.",
    ]));
    expect(within(dialog).queryByRole("button", { name: "Yes, send request" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a wrong or oversized file straight away", async () => {
    const { user, dialog } = await open();
    await user.upload(within(dialog).getByLabelText(/Photos/), new File(["x"], "a.gif", { type: "image/gif" }), );
    expect(within(dialog).getByRole("alert").textContent).toBe("Photos must be JPG or PNG.");
    const big = new File(["x"], "v.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    await user.upload(within(dialog).getByLabelText(/Video/), big);
    expect(within(dialog).getAllByRole("alert").map((a) => a.textContent)).toContain("Videos must be 25 MB or smaller.");
  });

  async function fillValid(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.click(within(dialog).getByRole("checkbox", { name: /Item 1/ }));
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "damaged");
    await user.upload(within(dialog).getByLabelText(/Photos/), photo);
    await user.click(within(dialog).getByRole("radio", { name: "Replacement" }));
  }

  test("asks to confirm before anything uploads or submits", async () => {
    const { user, dialog } = await open();
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    expect(await screen.findByText("Send this Return request?")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByText("Return items", { selector: "h2" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("uploads the photo, submits the Return and shows its RMA number", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/uploads")) return json({ id: "f1", uploadUrl: "https://files.test/put", uploadToken: "tok" }, 201);
      if (url === "https://files.test/put") return Promise.resolve(new Response(null, { status: 200 }));
      return json({ id: 15, number: "RMA-15", status: "requested" }, 201);
    });
    const { user, dialog } = await open();
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(await screen.findByRole("button", { name: "Yes, send request" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/RMA-15 requested/));
    const submit = fetchMock.mock.calls.find(([url]) => url === "/api/orders/7/returns")!;
    expect(JSON.parse(submit[1].body)).toEqual({ orderLineIds: [1], reason: "damaged", note: "",
      preferredResolution: "replacement", photoUploadTokens: ["tok"] });
    expect(refresh).toHaveBeenCalled();
  });

  test("returns to the form with the server's reason when the request is refused", async () => {
    fetchMock.mockImplementation(() => json({ error: "The 24-hour Return window has closed." }, 409));
    const { user, dialog } = await open();
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(await screen.findByRole("button", { name: "Yes, send request" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The 24-hour Return window has closed.");
  });
});

describe("Requested Return", () => {
  const requested = offer({ requested: { id: 15, number: "RMA-15" } });

  test("shows the RMA number and no Return button", () => {
    renderOrder(requested, true);
    expect(screen.getByText("Return RMA-15 requested.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Return items" })).toBeNull();
  });

  test("cancels only after the dialog is confirmed", async () => {
    fetchMock.mockImplementation(() => json({ id: 15, status: "cancelled" }));
    const user = userEvent.setup();
    renderOrder(requested, true);
    await user.click(screen.getByRole("button", { name: "Cancel return" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Yes, cancel Return" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/returns/15/cancel", expect.objectContaining({ method: "POST" })));
    expect((await screen.findByRole("status")).textContent).toBe("Return cancelled.");
  });

  test("keeping the Return cancels nothing, and a refused cancel shows why", async () => {
    const user = userEvent.setup();
    renderOrder(requested, true);
    await user.click(screen.getByRole("button", { name: "Cancel return" }));
    await user.click(await screen.findByRole("button", { name: "Keep Return" }));
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockImplementation(() => json({ error: "Return already changed or this move is not allowed." }, 409));
    await user.click(screen.getByRole("button", { name: "Cancel return" }));
    await user.click(await screen.findByRole("button", { name: "Yes, cancel Return" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already changed/);
  });
});
