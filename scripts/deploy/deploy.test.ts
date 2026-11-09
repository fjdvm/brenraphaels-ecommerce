import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const expectedRevision = "ca-ecommerce--gh-123-1";

describe("Storefront deploy CLI", () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(path.join(tmpdir(), "deploy-cli-")); });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function run(scenario: "delayed" | "stale" | "superseded") {
    // Azure is the external boundary. No cloud request or credential is used.
    const commands = {
      git: 'if [ "$SCENARIO" = superseded ]; then printf "newer\\trefs/heads/main\\n"; else printf "current\\trefs/heads/main\\n"; fi',
      python3: 'touch "$2"',
      curl: 'echo "health checked" > "$RUNNER_TEMP/http"',
      sleep: ":",
      az: `
        echo "$*" >> "$RUNNER_TEMP/azure-calls"
        case "$*" in
          "containerapp env show"*) echo environment;;
          "containerapp list"*) echo ca-ecommerce;;
          *customDomains*) echo '[]';;
          "containerapp create"*) :;;
          *healthState*) echo Healthy;;
          *latestReadyRevisionName*)
            if [ "$SCENARIO" = delayed ] && [ -f "$RUNNER_TEMP/queried" ]; then
              echo ca-ecommerce--gh-123-1
            else
              touch "$RUNNER_TEMP/queried"
              echo ca-ecommerce--previous
            fi;;
          *ingress.fqdn*) echo shop.example.invalid;;
          *) echo 'Unexpected Azure command' >&2; exit 2;;
        esac`,
    };
    for (const [name, body] of Object.entries(commands)) {
      writeFileSync(path.join(directory, name), `#!/bin/bash\n${body}\n`, { mode: 0o700 });
    }
    return spawnSync("bash", ["scripts/deploy/deploy.sh"], {
      cwd: root,
      env: {
        PATH: `${directory}:/usr/bin:/bin`, NODE_ENV: "test",
        SCENARIO: scenario, GITHUB_SHA: "current", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1",
        RESOURCE_GROUP: "rg-test", CONTAINER_APP: "ca-ecommerce",
        RUNNER_TEMP: directory, GITHUB_STEP_SUMMARY: path.join(directory, "summary"),
        STOREFRONT_IMAGE: "ghcr.io/test/storefront@sha256:abc",
      },
      encoding: "utf8", timeout: 10_000,
    });
  }

  it("waits for the app's ready pointer after revision health becomes Healthy", () => {
    const result = run("delayed");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(existsSync(path.join(directory, "http"))).toBe(true);
    expect(readFileSync(path.join(directory, "summary"), "utf8")).toContain(expectedRevision);
    expect(existsSync(path.join(directory, "ecommerce-deploy.json"))).toBe(false);
  });

  it("times out with useful diagnostics and never checks public health for a stale ready pointer", () => {
    const result = run("stale");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`Timed out waiting for ${expectedRevision}`);
    expect(result.stdout).toContain("latest ready revision=ca-ecommerce--previous");
    expect(existsSync(path.join(directory, "http"))).toBe(false);
    expect(existsSync(path.join(directory, "ecommerce-deploy.json"))).toBe(false);
  });

  it("skips a superseded commit before making any Azure or public HTTP request", () => {
    const result = run("superseded");
    expect(result.status).toBe(0);
    expect(existsSync(path.join(directory, "azure-calls"))).toBe(false);
    expect(existsSync(path.join(directory, "http"))).toBe(false);
    expect(readFileSync(path.join(directory, "summary"), "utf8")).toContain("Skipped superseded main commit");
  });
});
