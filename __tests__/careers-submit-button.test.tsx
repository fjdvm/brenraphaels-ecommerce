import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal<object>()), useFormStatus: () => status }));

import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";

describe("Careers SubmitButton", () => {
  it("shows its label while idle", () => {
    status.pending = false;
    const html = renderToStaticMarkup(<SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>);
    expect(html).toContain("Sign in");
    expect(html).not.toContain(`disabled=""`);
  });

  it("disables itself and shows the pending label while submitting", () => {
    status.pending = true;
    const html = renderToStaticMarkup(<SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>);
    expect(html).toContain("Signing in…");
    expect(html).toContain(`disabled=""`);
  });

  it("stays disabled when the caller disables it", () => {
    status.pending = false;
    expect(renderToStaticMarkup(<SubmitButton disabled pendingLabel="Submitting…">Submit</SubmitButton>)).toContain(`disabled=""`);
  });
});
