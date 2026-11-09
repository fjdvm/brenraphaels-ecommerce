import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const keys = [...readFileSync(path.join(root, ".env.production.example"), "utf8")
  .matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1]);
const secrets = Object.fromEntries([...keys, "GHCR_PULL_TOKEN"].map((key) => [key, `private-${key}`]));

describe("Azure deployment manifest CLI", () => {
  let directory: string;
  let output: string;
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "ecommerce-deploy-"));
    output = path.join(directory, "manifest.json");
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  function render(values = secrets) {
    return spawnSync("python3", ["-I", "scripts/deploy/render-container-app.py", output], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        DEPLOY_SECRETS: JSON.stringify(values),
        CONTAINER_ENVIRONMENT_ID: "/subscriptions/test/environments/cae-brenraphaels",
        GHCR_USERNAME: "fjdvm",
        REVISION_SUFFIX: "gh-123-1",
        STOREFRONT_IMAGE: "ghcr.io/fjdvm/brenraphaels-ecommerce@sha256:abc",
      },
      encoding: "utf8",
    });
  }
  it("requires the private Turnstile key and binds it to the runtime container", () => {
    const result = render({ ...secrets, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" });
    expect(result.status).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.properties.configuration.secrets).toContainEqual({
      name: "turnstile-secret-key", value: "1x0000000000000000000000000000000AA",
    });
    expect(manifest.properties.template.containers[0].env).toContainEqual({
      name: "TURNSTILE_SECRET_KEY", secretRef: "turnstile-secret-key",
    });
    rmSync(output);
    const missing = render({ ...secrets, TURNSTILE_SECRET_KEY: "" });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("TURNSTILE_SECRET_KEY");
    expect(existsSync(output)).toBe(false);
  });

  it("requires the public site key at runtime", () => {
    expect(render().status).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.properties.template.containers[0].env).toContainEqual({
      name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", secretRef: "next-public-turnstile-site-key",
    });
    rmSync(output);
    expect(render({ ...secrets, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" }).status).not.toBe(0);
    expect(existsSync(output)).toBe(false);
  });

  it("creates a private manifest for a healthy, always-on revision with rollback retention", () => {
    const result = render();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(statSync(output).mode & 0o777).toBe(0o600);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.location).toBe("indonesiacentral");
    expect(manifest.properties.environmentId).toBe("/subscriptions/test/environments/cae-brenraphaels");
    expect(manifest.properties.configuration).toMatchObject({
      activeRevisionsMode: "Single", maxInactiveRevisions: 10,
      registries: [{ server: "ghcr.io", username: "fjdvm", passwordSecretRef: "ghcr-pull-token" }],
      ingress: { external: true, targetPort: 3000, allowInsecure: false, traffic: [{ latestRevision: true, weight: 100 }] },
    });
    expect(manifest.properties.template.scale).toEqual({ minReplicas: 1, maxReplicas: 2 });
    const container = manifest.properties.template.containers[0];
    expect(container.image).toBe("ghcr.io/fjdvm/brenraphaels-ecommerce@sha256:abc");
    expect(container.resources).toEqual({ cpu: 0.5, memory: "1Gi" });
    expect(container.env).toContainEqual({ name: "DATABASE_URL", secretRef: "database-url" });
    expect(container.env).toContainEqual({ name: "NEXT_PUBLIC_SITE_URL", secretRef: "next-public-site-url" });
    expect(container.probes.map((probe: { type: string }) => probe.type)).toEqual(["Startup", "Readiness", "Liveness"]);
    for (const probe of container.probes) expect(probe.httpGet).toEqual({ path: "/api/health", port: 3000, scheme: "HTTP" });
  });
  it("allows absent optional integrations without sending empty Azure secrets", () => {
    const values = { ...secrets, CREOMS_SERVICE_SECRET_PREVIOUS: "", ORDERS_BLOB_READ_WRITE_TOKEN: "" };
    const result = render(values);
    expect(result.status).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.properties.configuration.secrets).not.toContainEqual(expect.objectContaining({ name: "orders-blob-read-write-token" }));
    expect(manifest.properties.template.containers[0].env).not.toContainEqual(expect.objectContaining({ name: "CREOMS_SERVICE_SECRET_PREVIOUS" }));
  });

  it("fails closed on missing required settings without logging any supplied values", () => {
    const values = { ...secrets, DATABASE_URL: "", GHCR_PULL_TOKEN: "" };
    const result = render(values);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATABASE_URL");
    expect(result.stderr).toContain("GHCR_PULL_TOKEN");
    expect(result.stdout + result.stderr).not.toContain("private-");
    expect(existsSync(output)).toBe(false);
  });

  it("maps GitHub-reserved application secret names back to runtime keys", () => {
    const values: Record<string, string> = { ...secrets, STOREFRONT_GITHUB_FEEDBACK_TOKEN: "feedback-token", STOREFRONT_GITHUB_FEEDBACK_REPOSITORY: "fjdvm/feedback" };
    delete values.GITHUB_FEEDBACK_TOKEN;
    delete values.GITHUB_FEEDBACK_REPOSITORY;
    const result = render(values);
    expect(result.status).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.properties.configuration.secrets).toContainEqual({ name: "github-feedback-token", value: "feedback-token" });
    expect(manifest.properties.template.containers[0].env).toContainEqual({ name: "GITHUB_FEEDBACK_REPOSITORY", secretRef: "github-feedback-repository" });
  });

});
