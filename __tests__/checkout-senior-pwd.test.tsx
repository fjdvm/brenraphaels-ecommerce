// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ addCheckoutAddress: vi.fn(), placeOrder: vi.fn(), uploadSeniorPwdPhoto: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(site)/(protected)/checkout/actions", () => actions);

import { CheckoutView } from "@/components/features/orders/checkout";
import type { Cart } from "@/lib/orders/cart";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const cart = {
  lines: [{ id: 7, productName: "Ube Halaya", sizeLabel: "250g jar", quantity: 2, priceInCentavos: 21_900, available: true, imageUrl: null }],
  subtotalInCentavos: 43_800,
} as unknown as Cart;

const view = (standing?: { verified: boolean; expiresOn: string | null }) =>
  render(<CheckoutView cart={cart} addresses={[]} seniorPwdStanding={standing} />);
const placeButton = () => screen.getByRole("button", { name: /Place order/ }) as HTMLButtonElement;
const photo = (name: string) => new File(["x"], name, { type: "image/png" });

describe("the Senior Citizen / PWD step", () => {
  test("is off by default and collects nothing until the Customer asks", () => {
    view();
    expect(screen.queryByLabelText(/ID number/)).toBeNull();
    expect(placeButton().disabled).toBe(false);
  });

  test("asks for the type, number and front photo (back optional), and nothing else", async () => {
    actions.uploadSeniorPwdPhoto.mockResolvedValue({ fileId: "front-1" });
    view();
    fireEvent.click(screen.getByLabelText(/I.m a Senior Citizen or PWD/));
    expect(screen.getByLabelText("Senior Citizen ID")).toBeTruthy();
    expect(screen.getByLabelText("PWD ID")).toBeTruthy();
    expect(screen.queryByLabelText(/name|birth|address/i)).toBeNull();
    expect(placeButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/ID number/), { target: { value: "ANT-SC-0458721" } });
    expect(placeButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Front of ID photo/), { target: { files: [photo("front-id.png")] } });
    expect(await screen.findByText("front-id.png · uploaded")).toBeTruthy();
    expect(placeButton().disabled).toBe(false);
    expect(screen.getByLabelText(/Back of ID photo/)).toBeTruthy();
  });

  test("shows the 5% as pending until the ID is checked, and sends it with the Order", async () => {
    actions.uploadSeniorPwdPhoto.mockResolvedValue({ fileId: "front-1" });
    actions.placeOrder.mockResolvedValue({ orderId: 5 });
    view();
    fireEvent.click(screen.getByLabelText(/I.m a Senior Citizen or PWD/));
    fireEvent.click(screen.getByLabelText("PWD ID"));
    fireEvent.change(screen.getByLabelText(/ID number/), { target: { value: "PWD-123456" } });
    fireEvent.change(screen.getByLabelText(/Front of ID photo/), { target: { files: [photo("f.png")] } });
    await screen.findByText("f.png · uploaded");
    expect(screen.getAllByText(/−₱10\.95 · after ID check/).length).toBeGreaterThan(0);
    expect(screen.getByText(/confirmed after we check your ID/)).toBeTruthy();
    fireEvent.click(placeButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(actions.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
      seniorPwd: { lineId: 7, idType: "pwd", idNumber: "PWD-123456", photoFileId: "front-1", photoBackFileId: undefined },
    })));
  });

  test("says why when a photo is refused", async () => {
    actions.uploadSeniorPwdPhoto.mockResolvedValue({ message: "ID photos must be 5 MB or smaller." });
    view();
    fireEvent.click(screen.getByLabelText(/I.m a Senior Citizen or PWD/));
    fireEvent.change(screen.getByLabelText(/Front of ID photo/), { target: { files: [photo("big.png")] } });
    expect((await screen.findByRole("alert")).textContent).toBe("ID photos must be 5 MB or smaller.");
  });

  test("a verified Customer never uploads again", async () => {
    actions.placeOrder.mockResolvedValue({ orderId: 5 });
    view({ verified: true, expiresOn: "2030-01-01" });
    fireEvent.click(screen.getByLabelText(/I.m a Senior Citizen or PWD/));
    expect(screen.getByText(/already verified until 2030-01-01/)).toBeTruthy();
    expect(screen.queryByLabelText(/ID number/)).toBeNull();
    expect(placeButton().disabled).toBe(false);
    expect(screen.getAllByText(/−₱10\.95/).every((node) => !node.textContent?.includes("after ID check"))).toBe(true);
    fireEvent.click(placeButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(actions.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ seniorPwd: { lineId: 7 } })));
  });
});
