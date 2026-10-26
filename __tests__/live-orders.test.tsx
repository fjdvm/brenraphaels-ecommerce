// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ ordersLiveUrl: vi.fn() }));

import { LiveOrders } from "@/components/features/orders/live-orders";
import type { ConnectOrdersLive } from "@/lib/orders/live";

type Handlers = Parameters<ConnectOrdersLive>[0];

/** The live socket faked at the browser boundary: tests drive the line from outside. */
function fakeLine() {
  const lines: { handlers: Handlers; close: ReturnType<typeof vi.fn> }[] = [];
  const connect: ConnectOrdersLive = (handlers) => {
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

describe("Customer's open Orders page, live", () => {
  test("refetches when an Order status event arrives", () => {
    const line = fakeLine();
    render(<LiveOrders connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "order.updated", orderId: "7" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("refetches when a Return decision event arrives", () => {
    const line = fakeLine();
    render(<LiveOrders connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "return.updated", orderId: "7", returnId: "3" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("ignores frames that are not Order or Return events", () => {
    const line = fakeLine();
    render(<LiveOrders connect={line.connect} />);
    act(() => line.current().onOpen());
    refresh.mockClear();

    act(() => line.current().onEvent({ type: "presence" } as never));
    act(() => line.current().onEvent(undefined as never));

    expect(refresh).not.toHaveBeenCalled();
  });

  test("refetches the Orders on every connect, so nothing missed while down stays stale", () => {
    const line = fakeLine();
    render(<LiveOrders connect={line.connect} />);

    act(() => line.current().onOpen());
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => line.current().onClose());
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(line.lines).toHaveLength(2);

    act(() => line.current().onOpen());
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test("waits longer after each failed attempt, and starts over once connected", () => {
    const line = fakeLine();
    render(<LiveOrders connect={line.connect} />);

    for (const wait of [3_000, 6_000, 12_000]) {
      act(() => line.current().onClose());
      act(() => {
        vi.advanceTimersByTime(wait - 1);
      });
      const before = line.lines.length;
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(line.lines).toHaveLength(before + 1);
    }

    act(() => line.current().onOpen());
    act(() => line.current().onClose());
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(line.lines).toHaveLength(5);
  });

  test("closes the line when the page is left and does not reconnect", () => {
    const line = fakeLine();
    const { unmount } = render(<LiveOrders connect={line.connect} />);
    const first = line.lines[0];

    unmount();
    first.handlers.onClose();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(first.close).toHaveBeenCalled();
    expect(line.lines).toHaveLength(1);
  });
});
