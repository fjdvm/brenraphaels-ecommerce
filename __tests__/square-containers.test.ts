import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Containers are square (AGENTS.md "Square containers"). Pills, buttons, badges, avatars and circular icon buttons
// use rounded-full; everything else must not round its corners. A file listed below still rounds a container and
// is migrated by a later square-look ticket; remove its entry when it is clean (a stale entry fails this test).
const root = path.resolve(import.meta.dirname, "..");
const roots = ["app", "components"];
const rounded = /(?<![\w-])rounded(?:-[trbl]{1,2})?(?:-(?!full\b|none\b)[\w\[\]./]+)?(?![\w-])/;
const allowed: Record<string, string> = {
  "app/(site)/page.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/home/bestsellers.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/home/video-card.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/shared/auth-shell.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/footer.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/header.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/page-transition.tsx": "Shared shell logo/loader image: square in the Shell slice",
};

function sources(dir: string): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  return names.flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === "node_modules" ? [] : sources(file);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

const rounding = roots
  .flatMap((r) => sources(path.join(root, r)))
  .map((file) => path.relative(root, file).split(path.sep).join("/"))
  .filter((file) => rounded.test(readFileSync(path.join(root, file), "utf8")));

describe("square containers", () => {
  it("rounds no container outside the allowlist", () => {
    expect(rounding.filter((file) => !(file in allowed))).toEqual([]);
  });

  it("lists only files that still round a container", () => {
    expect(Object.keys(allowed).filter((file) => !rounding.includes(file))).toEqual([]);
  });
});
