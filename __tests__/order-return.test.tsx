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
  deliveredAtMs: now - 60 * 60_000, windowExtended: false, paymentMethod: "gcash", lines: [line(1), line(2), line(3, false)], requested: null, savedRefundDestination: null, refundable: true, ...patch,
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

  test("offers a refund the way the Customer paid, with the amount for the chosen items", async () => {
    const { user, dialog } = await open();
    expect(within(dialog).getByText("Refund to GCash")).toBeTruthy();
    await user.click(within(dialog).getByRole("checkbox", { name: /Item 1/ }));
    expect(within(dialog).getByText(/Refund to GCash · ₱100/)).toBeTruthy();
    expect(within(dialog).getByText(/sent to your GCash within 3 working days/i)).toBeTruthy();
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

describe("Refund destination", () => {
  const saved = { method: "gcash" as const, accountName: "Maria Santos", accountNumber: "09171234567", bankName: null };

  async function openForRefund(returnOffer = offer()) {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, applyAccept: false });
    renderOrder(returnOffer);
    await user.click(await screen.findByRole("button", { name: "Return items" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: /Item 1/ }));
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "damaged");
    await user.upload(within(dialog).getByLabelText(/Photos/), photo);
    await user.click(within(dialog).getByRole("radio", { name: /^Refund/ }));
    return { user, dialog };
  }

  test("asks for the method, account name and number only when a refund is chosen, never pre-filled from a payment proof", async () => {
    const { user, dialog } = await openForRefund();
    expect(within(dialog).getByLabelText("Refund method")).toBeTruthy();
    expect((within(dialog).getByLabelText("Account name") as HTMLInputElement).value).toBe("");
    expect(within(dialog).queryByLabelText("Bank name")).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText("Refund method"), "bank-transfer");
    expect(within(dialog).getByLabelText("Bank name")).toBeTruthy();
    await user.click(within(dialog).getByRole("radio", { name: "Replacement" }));
    expect(within(dialog).queryByLabelText("Refund method")).toBeNull();
  });

  test("pre-fills only from the details the Customer confirmed before", async () => {
    const { dialog } = await openForRefund(offer({ savedRefundDestination: saved }));
    expect((within(dialog).getByLabelText("Account name") as HTMLInputElement).value).toBe("Maria Santos");
    expect((within(dialog).getByLabelText("Account number") as HTMLInputElement).value).toBe("09171234567");
    expect((within(dialog).getByLabelText("Refund method") as HTMLSelectElement).value).toBe("gcash");
  });

  test("names every missing detail and will not review until the Customer confirms them", async () => {
    const { user, dialog } = await openForRefund();
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    expect(within(dialog).getAllByRole("alert").map((a) => a.textContent)).toEqual(expect.arrayContaining([
      "Choose where to send your refund.", "Enter the account name.", "Enter the account number.",
      "Confirm your refund details before continuing.",
    ]));
    expect(screen.queryByText("Send this Return request?")).toBeNull();
  });

  test("is not asked for a Cash on Delivery Order whose cash was not collected", async () => {
    const { dialog } = await openForRefund(offer({ paymentMethod: "cash-on-delivery", refundable: false }));
    expect(within(dialog).queryByLabelText("Refund method")).toBeNull();
    expect(within(dialog).getByText(/nothing to refund/)).toBeTruthy();
  });

  test("shows the details on the confirm step and sends them confirmed", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/uploads")) return json({ id: "f1", uploadUrl: "https://files.test/put", uploadToken: "tok" }, 201);
      if (url === "https://files.test/put") return Promise.resolve(new Response(null, { status: 200 }));
      return json({ id: 15, number: "RMA-15", status: "requested" }, 201);
    });
    const { user, dialog } = await openForRefund(offer({ savedRefundDestination: saved }));
    await user.click(within(dialog).getByRole("checkbox", { name: /I confirm these refund details/ }));
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    const summary = await screen.findByLabelText("Refund destination");
    expect(summary.textContent).toContain("09171234567");
    await user.click(screen.getByRole("button", { name: "Yes, send request" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/RMA-15 requested/));
    const submit = fetchMock.mock.calls.find(([url]) => url === "/api/orders/7/returns")!;
    expect(JSON.parse(submit[1].body).refundDestination).toEqual({ method: "gcash", accountName: "Maria Santos",
      accountNumber: "09171234567", bankName: "", confirmed: true });
  });

  test("editing a detail after confirming asks for the confirmation again", async () => {
    const { user, dialog } = await openForRefund(offer({ savedRefundDestination: saved }));
    const confirm = within(dialog).getByRole("checkbox", { name: /I confirm these refund details/ }) as HTMLInputElement;
    await user.click(confirm);
    expect(confirm.checked).toBe(true);
    await user.type(within(dialog).getByLabelText("Account number"), "0");
    expect(confirm.checked).toBe(false);
  });
});

describe("Optimistic request", () => {
  async function submit(send: (url: string) => Promise<Response>) {
    fetchMock.mockImplementation(send);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, applyAccept: false });
    renderOrder(offer());
    await user.click(await screen.findByRole("button", { name: "Return items" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: /Item 1/ }));
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "damaged");
    await user.upload(within(dialog).getByLabelText(/Photos/), photo);
    await user.click(within(dialog).getByRole("radio", { name: "Replacement" }));
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(await screen.findByRole("button", { name: "Yes, send request" }));
  }

  test("shows the Return as requested the moment the Customer confirms, before the server answers", async () => {
    await submit(() => new Promise<Response>(() => {}));
    expect((await screen.findByRole("status")).textContent).toBe("Return requested. Sending…");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("rolls back and reopens the form with the reason when the server refuses", async () => {
    await submit(() => json({ error: "The 24-hour Return window has closed." }, 409));
    expect((await screen.findByRole("alert")).textContent).toBe("The 24-hour Return window has closed.");
    expect(screen.queryByText("Return requested. Sending…")).toBeNull();
    expect(screen.getByRole("button", { name: "Review request" })).toBeTruthy();
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
