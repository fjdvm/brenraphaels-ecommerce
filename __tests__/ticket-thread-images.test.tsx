// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock("@/app/(site)/(protected)/support/actions", () => ({ sendMessage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img alt={alt} src={src} />,
}));

import { TicketThread } from "@/components/features/support/ticket-thread";
import type { ConnectLive } from "@/lib/support/live";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const connect: ConnectLive = () => ({ close: vi.fn(), send: vi.fn() });
const at = new Date("2026-11-17T15:48:00Z");
const messages = [
  { id: 1, sender: "staff" as const, body: "", attachmentPathname: null, fileId: "f1", createdAt: at },
  { id: 2, sender: "customer" as const, body: "Thanks", attachmentPathname: null, fileId: null, createdAt: at },
  { id: 3, sender: "customer" as const, body: "", attachmentPathname: null, fileId: "f3", createdAt: at },
];
const view = () => render(<TicketThread connect={connect} createdAt={at} messages={messages} ticketId={9} />);

describe("images in a Ticket thread", () => {
  test("opens full screen when clicked, and the arrows move between the thread's images", async () => {
    const user = userEvent.setup();
    view();
    const open = screen.getAllByRole("button", { name: "View image full size" });
    expect(open).toHaveLength(2);

    await user.click(open[0]);
    const viewer = await screen.findByRole("dialog", { name: "Images in this conversation" });
    expect(viewer.textContent).toContain("1 / 2");
    expect(viewer.textContent).toContain("Customer Care ·");
    expect(within(viewer).getByAltText("Image from Customer Care").getAttribute("src")).toBe("/api/support/attachments/1");

    await user.click(within(viewer).getByRole("button", { name: "Next image" }));
    expect(viewer.textContent).toContain("2 / 2");
    expect(viewer.textContent).toContain("You ·");
    expect(within(viewer).getByAltText("Image from You").getAttribute("src")).toBe("/api/support/attachments/3");

    await user.click(within(viewer).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("replying with a picture", () => {
  test("needs no words once an image is picked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    sendMessage.mockResolvedValue({ sent: true, messageId: 10 });
    view();
    const box = screen.getByLabelText("Write a message") as HTMLTextAreaElement;
    expect(box.required).toBe(true);

    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "p.png", { type: "image/png" })] } });
    await waitFor(() => expect((screen.getByLabelText("Write a message") as HTMLTextAreaElement).required).toBe(false));

    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect((sendMessage.mock.calls[0][2] as FormData).get("body")).toBe("");
  });
});
