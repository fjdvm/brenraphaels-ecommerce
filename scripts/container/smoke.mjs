import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
async function response(path, options) {
  return fetch(new URL(path, base), { signal: AbortSignal.timeout(30000), ...options });
}
const health = await response('/api/health');
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });
const config = await response('/api/public-config');
assert.equal(config.status, 200);
assert.deepEqual(await config.json(), { turnstileSiteKey: '1x00000000000000000000AA' });
const home = await response('/');
assert.equal(home.status, 200);
const html = await home.text();
assert.ok(html.includes('Bestsellers'));
assert.ok(html.includes('Container Smoke Ube'), 'Seeded catalog product must render');
assert.ok(!html.replaceAll(String.fromCharCode(92), "").includes('"digest":') && !html.includes("data-dgst="), "Home must render without a streamed server error");
assert.ok(html.includes('www.gstatic.com'), 'Catalog must use the runtime image origin');
for (const source of ['/images/home/ube-halaya.jpg', 'https://www.gstatic.com/webp/gallery/1.png']) {
  const image = await response(`/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`);
  assert.equal(image.status, 200, `Optimizer must load ${source}`);
  assert.match(image.headers.get('content-type'), /^image\//);
  assert.ok((await image.arrayBuffer()).byteLength > 100);
}
assert.equal((await response('/_next/image?url=https%3A%2F%2Fexample.com%2Fimage.png&w=640&q=75')).status, 400);
assert.equal((await response('/_next/image?url=https%3A%2F%2Fwww.gstatic.com%2Fwebp%2Fgallery%2F1.png%3Funexpected%3D1&w=640&q=75')).status, 400);
const cron = '/api/cron/delivery-photo-retention';
assert.equal((await response(cron)).status, 401);
assert.equal((await response(cron, { headers: { authorization: 'Bearer wrong-secret' } })).status, 401);
assert.equal((await response(cron, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status, 200);
console.log('Container health, home, optimized catalog image and cron authorization passed.');
