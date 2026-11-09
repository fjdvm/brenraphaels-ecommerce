import { readFileSync, writeFileSync } from 'node:fs';

// Next serializes next.config at build time. Insert the runtime-only image
// allowlist before it hands that config to the server. Fail on upstream changes.
const path = '.next/standalone/server.js';
const source = readFileSync(path, 'utf8');
const marker = 'process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)';
if (source.split(marker).length !== 2) throw new Error('Next standalone config hook changed');
const runtimeImages = `
if (process.env.PRODUCT_IMAGE_ORIGIN) {
  const origin = new URL(process.env.PRODUCT_IMAGE_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('PRODUCT_IMAGE_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment.');
  }
  nextConfig.images.remotePatterns = [{ protocol: 'https', hostname: origin.hostname, port: origin.port, pathname: '/**', search: '' }];
}
`;
writeFileSync(path, source.replace(marker, runtimeImages + marker));
