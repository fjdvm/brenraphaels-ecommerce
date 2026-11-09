#!/usr/bin/env bash
set -euo pipefail
image=${CONTAINER_IMAGE:-storefront:smoke}
network="storefront-smoke-${GITHUB_RUN_ID:-local}-$$"
database="$network-db"
app="$network-app"
gateway="$network-gateway"
cleanup() {
  docker logs "$app" 2>/dev/null || true
  docker rm -f "$app" "$database" "$gateway" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" \
  -e POSTGRES_PASSWORD=smoke -e POSTGRES_USER=smoke -e POSTGRES_DB=storefront \
  -p 127.0.0.1::5432 postgres:17-bookworm >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$database" pg_isready -U smoke -d storefront >/dev/null; then break; fi
  sleep 1
done
port=$(docker port "$database" 5432/tcp | cut -d: -f2)
DATABASE_URL_UNPOOLED="postgresql://smoke:smoke@127.0.0.1:$port/storefront" npm run db:migrate
docker exec -i "$database" psql -U smoke -d storefront -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO products (slug, name, description) VALUES ('smoke-ube', 'Container Smoke Ube', 'Disposable smoke fixture');
INSERT INTO product_images (product_slug, file_id, alt, position) VALUES ('smoke-ube', 'smoke-ube', 'Smoke Ube', 0);
INSERT INTO sizes (product_slug, label, price_in_centavos, available) VALUES ('smoke-ube', '250g', 15000, true);
SQL
docker run -d --name "$gateway" --network "$network" \
  -v "$PWD/scripts/container/gateway-fixture.mjs:/fixture.mjs:ro" \
  --entrypoint node "$image" /fixture.mjs >/dev/null
# Check process liveness with an unreachable DB first.
docker run -d --name "$app" --network "$network" -p 127.0.0.1::3000 \
  -e DATABASE_URL=postgresql://smoke:smoke@127.0.0.1:1/unavailable \
  -e NEON_AUTH_BASE_URL=https://auth.invalid/auth \
  -e NEON_AUTH_COOKIE_SECRET=smoke-only-cookie-secret-at-least-32-characters \
  -e PRODUCT_IMAGE_ORIGIN=https://www.gstatic.com \
  -e API_GATEWAY_URL="http://$gateway:8080" \
  -e API_GATEWAY_CALLER_KEY=smoke-gateway-key \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  -e TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
  -e CRON_SECRET=smoke-cron-secret "$image" >/dev/null
app_port=$(docker port "$app" 3000/tcp | cut -d: -f2)
curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 1 "http://127.0.0.1:$app_port/api/health"
docker rm -f "$app" >/dev/null
docker run -d --name "$app" --network "$network" -p 127.0.0.1::3000 \
  -e DATABASE_URL="postgresql://smoke:smoke@$database:5432/storefront" \
  -e NEON_AUTH_BASE_URL=https://auth.invalid/auth \
  -e NEON_AUTH_COOKIE_SECRET=smoke-only-cookie-secret-at-least-32-characters \
  -e PRODUCT_IMAGE_ORIGIN=https://www.gstatic.com \
  -e API_GATEWAY_URL="http://$gateway:8080" \
  -e API_GATEWAY_CALLER_KEY=smoke-gateway-key \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  -e TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
  -e CRON_SECRET=smoke-cron-secret "$image" >/dev/null
app_port=$(docker port "$app" 3000/tcp | cut -d: -f2)
curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 1 "http://127.0.0.1:$app_port/api/health"
SMOKE_BASE_URL="http://127.0.0.1:$app_port" CRON_SECRET=smoke-cron-secret node scripts/container/smoke.mjs

# Read only these public action IDs from the built image; never print the manifest
# (it also contains Next's encryption key).
auth_actions=$(docker exec "$app" node -e '
  const manifest = require("./.next/server/server-reference-manifest.json");
  const names = ["submitSignUp", "submitForgotPassword", "resendVerificationEmail"];
  console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.node)
    .filter(([, action]) => names.includes(action.exportedName))
    .map(([id, action]) => [action.exportedName, id]))));
')
SMOKE_BASE_URL="http://127.0.0.1:$app_port" SMOKE_AUTH_ACTIONS="$auth_actions" node scripts/container/auth-rate-limit.mjs
