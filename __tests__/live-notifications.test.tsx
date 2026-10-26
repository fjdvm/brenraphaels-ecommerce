// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(site)/(protected)/profile/notifications/actions", () => ({ notificationsLiveUrl: vi.fn() }));

import { LiveNotifications } from "@/components/features/customer/live-notifications";
import type { ConnectNotificationsLive } from "@/lib/notifications/live";

type Handlers = Parameters<ConnectNotificationsLive>[0];

/** The live socket faked at the browser boundary: tests drive the line from outside. */
function fakeLine() {
  const lines: { handlers: Handlers; close: ReturnType<typeof vi.fn> }[] = [];
  const connect: ConnectNotificationsLive = (handlers) => {
    const close = vi.fn();
    lines.push({ handlers, close });
    return { close };
  };
  return { connect, lines, current: () => lines[lines.length - 1].handlers };
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Customer's open pages, live Notifications", () => {
  test("refetches the inbox when a Notification arrives", () => {
    const line = fakeLine();
    render(<LiveNotifications connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "notification.created", notification: { id: "n-1" } }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("refetches when a Notification is read in another tab", () => {
    const line = fakeLine();
    render(<LiveNotifications connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "notifications.read", ids: ["n-1"] }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("ignores frames that are not Notification events", () => {
    const line = fakeLine();
    render(<LiveNotifications connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "presence" } as never));
    act(() => line.current().onEvent(undefined as never));

    expect(refresh).not.toHaveBeenCalled();
  });

  test("refetches on every connect, so what arrived while offline is waiting on return", () => {
    const line = fakeLine();
    render(<LiveNotifications connect={line.connect} />);

    act(() => line.current().onOpen());
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => line.current().onClose());
    act(() => void vi.advanceTimersByTime(3_000));
    expect(line.lines).toHaveLength(2);
    act(() => line.current().onOpen());
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test("backs off while the line keeps failing, and stops when the page unmounts", () => {
    const line = fakeLine();
    const { unmount } = render(<LiveNotifications connect={line.connect} />);

    act(() => line.current().onClose());
    act(() => void vi.advanceTimersByTime(2_999));
    expect(line.lines).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(line.lines).toHaveLength(2);

    act(() => line.current().onClose());
    act(() => void vi.advanceTimersByTime(5_999));
    expect(line.lines).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(1));
    expect(line.lines).toHaveLength(3);

    unmount();
    expect(line.lines[2].close).toHaveBeenCalled();
    act(() => line.lines[2].handlers.onClose());
    act(() => void vi.advanceTimersByTime(120_000));
    expect(line.lines).toHaveLength(3);
  });
});
