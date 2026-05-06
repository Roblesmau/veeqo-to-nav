// Vercel serverless proxy for the Veeqo API.
//
// Browser calls   ->   /api/orders, /api/channels, etc.
// We forward to   ->   https://api.veeqo.com/orders, /channels, etc.
//
// Same-origin: the static index.html is served from the same Vercel domain,
// so no CORS dance is needed.

const TARGET = 'https://api.veeqo.com';

module.exports = async function handler(req, res) {
  // Remove /api prefix and forward whatever path + query came in.
  // Example: /api/orders?page=1  -> /orders?page=1
  const upstreamPath = req.url.replace(/^\/api/, '') || '/';
  const upstreamUrl = TARGET + upstreamPath;

  // Forward headers but drop ones that confuse upstream (host/origin/referer).
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  delete headers['x-forwarded-for'];
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  delete headers['x-vercel-id'];
  delete headers['x-vercel-deployment-url'];
  delete headers['x-vercel-forwarded-for'];

  // For non-GET/HEAD, gather the request body.
  let body;
  if (!['GET','HEAD'].includes(req.method)) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, { method: req.method, headers, body });
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: String(err) });
    return;
  }

  res.status(upstream.status);

  // Pipe headers from upstream (skip a few that the platform sets itself).
  const skipHeaders = new Set(['content-encoding','transfer-encoding','content-length','connection']);
  upstream.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) res.setHeader(key, value);
  });

  // Allow the page to read the response (defensive — same-origin already, but doesn't hurt).
  res.setHeader('Access-Control-Allow-Origin', '*');

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
};
