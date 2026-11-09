// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/script", () => ({ default: ({ onReady }: { onReady: () => void }) =>
  <button type="button" onClick={onReady}>Load security check</button> }));

import { TurnstileWidget } from "@/components/features/auth/turnstile-widget";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("publishes a token and clears expired, failed, and consumed challenges", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ turnstileSiteKey: "1x00000000000000000000AA" })));
  const renderWidget = vi.fn().mockReturnValue("widget-id");
  const remove = vi.fn();
  vi.stubGlobal("turnstile", { render: renderWidget, remove });
  const { container, rerender, unmount } = render(<form><TurnstileWidget resetKey={0} /></form>);
  await act(async () => screen.getByText("Load security check").click());
  const options = renderWidget.mock.calls[0][1];
  expect(options.sitekey).toBe("1x00000000000000000000AA");
  const form = container.querySelector("form")!;
  act(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"));
  expect(new FormData(form).get("cf-turnstile-response")).toBe("XXXX.DUMMY.TOKEN.XXXX");
  act(() => options["expired-callback"]());
  expect(new FormData(form).get("cf-turnstile-response")).toBe("");
  act(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"));
  act(() => options["error-callback"]());
  expect(new FormData(form).get("cf-turnstile-response")).toBe("");
  expect(screen.getByRole("alert").textContent).toContain("security check");
  act(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"));
  rerender(<form><TurnstileWidget resetKey={1} /></form>);
  expect(remove).toHaveBeenCalledWith("widget-id");
  expect(new FormData(form).get("cf-turnstile-response")).toBe("");
  expect(renderWidget).toHaveBeenCalledTimes(2);
  unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});
