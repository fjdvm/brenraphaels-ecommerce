import { createServer } from 'node:http';

// Only file metadata is faked. The optimizer fetches Google's public WebP
// sample over HTTPS, exercising the runtime origin allowlist and native sharp.
createServer((request, response) => {
  if (request.url !== '/files/smoke-ube' || request.headers.authorization !== 'Bearer smoke-gateway-key') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({
    status: 'active', visibility: 'public', retentionType: 'permanent',
    contentType: 'image/png', url: 'https://www.gstatic.com/webp/gallery/1.png',
  }));
}).listen(8080, '0.0.0.0');
