require('dotenv/config');

const http = require('http');
const httpProxy = require('http-proxy');
const prettyMs = require('pretty-ms');
const {
  BOT_PROXY_TARGET_URL,
  PORT = 80
} = process.env;

const proxy = httpProxy.createProxyServer({});

// proxy.on('proxyReq', (proxyReq, req, res, options) => {
// });

const up = Date.now();

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const message = `Bot Proxy is up since ${ prettyMs(Date.now() - up) } ago, proxying to ${ BOT_PROXY_TARGET_URL }.`;
    const separator = new Array(message.length).fill('-').join('');

    res.setHeader('Content-Type', 'text/plain');
    res.end(JSON.stringify({
      human: [
        separator,
        message,
        separator
      ],
      computer: {
        up: new Date(up).toISOString(),
        url: BOT_PROXY_TARGET_URL
      }
    }, null, 2));
  } else if (req.url === '/health.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
  } else {
    proxy.web(req, res, {
      changeOrigin: true,
      target: BOT_PROXY_TARGET_URL,
      ws: true,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Bot proxy listening on port ${ PORT } and is proxying to ${ BOT_PROXY_TARGET_URL }.`);
});
