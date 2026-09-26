import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

const root = join(__dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// Next throws when a "use server" module loads if it exports anything but async
// functions (types are erased, so they are fine). The page then shows "This page
// couldn't load" on every call, so a shared initial form state must live in the form.
test('"use server" files export only async functions and types', () => {
  const offences = ["app", "lib", "components"]
    .flatMap((directory) => sourceFiles(join(root, directory)))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use server["']/.test(source)) {
        return [];
      }
      return source
        .split("\n")
        .filter((line) => /^export\s/.test(line))
        .filter((line) => !/^export\s+(type|interface)\s/.test(line))
        .filter((line) => !/^export\s+async\s+function\s/.test(line))
        .filter((line) => !/^export\s+const\s+\w+\s*=\s*async\b/.test(line))
        .map((line) => `${file.slice(root.length + 1)}: ${line}`);
    });

  expect(offences).toEqual([]);
});
