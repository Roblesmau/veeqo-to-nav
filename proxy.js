// Tiny CORS proxy for Veeqo API.
// Run only if the browser blocks direct calls to api.veeqo.com.
//
//   node proxy.js
//
// Then in the app, switch "Base URL" to http://localhost:8787
// The browser will send your x-api-key header; this proxy just forwards it.

const http = require('http');
const https = require('https');

// PORT comes from the hosting platform (Render/Railway/Fly set process.env.PORT).
// Locally we fall back to 8787.
const PORT = process.env.PORT || 8787;
const TARGET = 'api.veeqo.com';

http.createServer((req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Health check (used by Render/Netlify uptime pings)
  if (req.url === '/' || req.url === '/health'){
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('Veeqo proxy OK');
  }

  const opts = {
    host: TARGET,
    port: 443,
    method: req.method,
    path: req.url,
    headers: {
      ...req.headers,
      host: TARGET,
    },
  };
  delete opts.headers['origin'];
  delete opts.headers['referer'];

  const upstream = https.request(opts, up => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    res.writeHead(502); res.end(JSON.stringify({error:String(err)}));
  });
  req.pipe(upstream);
}).listen(PORT, () => console.log(`Veeqo proxy on http://localhost:${PORT} -> https://${TARGET}`));
