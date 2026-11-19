// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(site)/storefront-live-actions", () => ({ storefrontLiveUrl: vi.fn() }));
vi.mock("@/app/(site)/(protected)/profile/notifications/actions", () => ({ notificationsLiveUrl: vi.fn() }));

import { LiveStorefront } from "@/components/features/storefront/live-storefront";
import type { ConnectNotificationsLive } from "@/lib/notifications/live";

type Handlers = Parameters<ConnectNotificationsLive>[0];

function fakeLine() {
  const lines: { handlers: Handlers; close: ReturnType<typeof vi.fn> }[] = [];
  const connect: ConnectNotificationsLive = (handlers) => {
    const close = vi.fn();
    lines.push({ handlers, close });
    return { close };
  };
  return { connect, lines, current: () => lines[lines.length - 1].handlers };
}

beforeEach(() => { vi.useFakeTimers(); refresh.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("every open storefront page, live shop settings", () => {
  test("refreshes the page when the shop says a setting changed", () => {
    const line = fakeLine();
    render(<LiveStorefront connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();
    act(() => line.current().onEvent({ type: "notification.created", notification: { id: "n1" } }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("does not refetch on the first connect: the page was just loaded", () => {
    const line = fakeLine();
    render(<LiveStorefront connect={line.connect} />);
    act(() => line.current().onOpen());
    expect(refresh).not.toHaveBeenCalled();
  });

  test("refetches after a reconnect, since events are not replayed", () => {
    const line = fakeLine();
    render(<LiveStorefront connect={line.connect} />);
    act(() => line.current().onOpen());
    act(() => line.current().onClose());
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(line.lines).toHaveLength(2);
    act(() => line.current().onOpen());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("ignores frames it does not know and closes the line on leaving", () => {
    const line = fakeLine();
    const view = render(<LiveStorefront connect={line.connect} />);
    act(() => line.current().onOpen());
    act(() => line.current().onEvent({ type: "notifications.read", ids: [] }));
    expect(refresh).not.toHaveBeenCalled();
    view.unmount();
    expect(line.lines[0].close).toHaveBeenCalled();
  });
});
