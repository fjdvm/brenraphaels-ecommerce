// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const motion = vi.hoisted(() => {
  const controls = { pause: vi.fn(), play: vi.fn(), cancel: vi.fn() };
  return { controls, animate: vi.fn(() => controls), reduceMotion: false };
});
const { controls, animate } = motion;

vi.mock("motion/react", () => ({ animate: motion.animate }));

import { KindWords } from "@/components/features/home/kind-words";

beforeEach(() => {
  motion.reduceMotion = false;
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: motion.reduceMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 1000 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Kind words", () => {
  test("shows the heading and the reviews, with the looped copy hidden from assistive tech", () => {
    render(<KindWords />);
    expect(screen.getByRole("heading", { name: "Loved by ube lovers" })).toBeTruthy();
    expect(screen.getAllByText("SOOOO GOOD! Definitely!!!").length).toBe(8);
    const hidden = document.querySelectorAll('li[aria-hidden="true"]');
    const visible = document.querySelectorAll("li:not([aria-hidden])");
    expect(hidden.length).toBe(visible.length);
  });

  test("loops each lane forever at its own pace, one sequence plus the gap", () => {
    render(<KindWords />);
    const calls = animate.mock.calls as unknown as [unknown, { y: number[] }, { duration: number; repeat: number; ease: string }][];
    expect(calls.map(([, , options]) => options.duration)).toEqual([48, 60, 72, 60]);
    for (const [, keyframes, options] of calls) {
      expect(keyframes.y).toEqual([0, -508]);
      expect(options.repeat).toBe(Infinity);
      expect(options.ease).toBe("linear");
    }
  });

  test("pauses on hover and focus and resumes where it left off", () => {
    render(<KindWords />);
    const region = screen.getByRole("region", { name: "Customer reviews" });

    fireEvent.pointerEnter(region);
    expect(controls.pause).toHaveBeenCalled();
    fireEvent.pointerLeave(region);
    expect(controls.play).toHaveBeenCalled();

    controls.pause.mockClear();
    fireEvent.focus(region);
    expect(controls.pause).toHaveBeenCalled();
    fireEvent.blur(region);
    expect(controls.play).toHaveBeenCalled();
    expect(animate).toHaveBeenCalledTimes(4);
  });

  test("leaving hover keeps the reviews paused while keyboard focus is inside", () => {
    render(<KindWords />);
    const region = screen.getByRole("region", { name: "Customer reviews" });
    fireEvent.focus(region);
    fireEvent.pointerEnter(region);
    controls.play.mockClear();
    fireEvent.pointerLeave(region);
    expect(controls.play).not.toHaveBeenCalled();
    fireEvent.blur(region);
    expect(controls.play).toHaveBeenCalled();
  });

  test("does not auto-scroll under reduced motion", () => {
    motion.reduceMotion = true;
    render(<KindWords />);
    expect(animate).not.toHaveBeenCalled();
  });
});
