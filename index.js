require('dotenv/config');

const httpProxy = require('http-proxy');
const {
  BOT_PROXY_TARGET_URL,
  PORT = 80
} = process.env;

httpProxy.createProxyServer({
  target: BOT_PROXY_TARGET_URL,
  ws: true,
}).listen(PORT, () => {
  console.log(`Bot proxy listening on port ${ PORT } and is proxying to ${ BOT_PROXY_TARGET_URL }.`);
});
