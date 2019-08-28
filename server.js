require('dotenv/config');

const http = require('http');
// const httpProxy = require('http-proxy');
const prettyMs = require('pretty-ms');
const { Watershed } = require('watershed');
const { Server } = require('net');

const {
  PIPE_NAME = 'bfv4.pipes',
  PORT = 80
} = process.env;

const {
  INCOMING_PIPE_NAME = `\\\\.\\pipe\\${ PIPE_NAME }.incoming`,
  OUTGOING_PIPE_NAME = `\\\\.\\pipe\\${ PIPE_NAME }.outgoing`
} = process.env;

// const proxy = httpProxy.createProxyServer({});

// proxy.on('proxyReq', (proxyReq, req, res, options) => {
// });

let numIncomingNamedPipes = 0;
let numOutgoingNamedPipes = 0;
let numWebSockets = 0;
const up = Date.now();

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const message = `Bot Proxy is up since ${ prettyMs(Date.now() - up) } ago. ${ ws ? 'A client is connected.' : 'No client is connected.' }`;
    const separator = new Array(message.length).fill('-').join('');

    res.setHeader('Content-Type', 'text/plain');
    res.end(JSON.stringify({
      human: [
        separator,
        message,
        separator
      ],
      computer: {
        botConnected: !!ws,
        namedPipe: {
          incoming: {
            name: INCOMING_PIPE_NAME,
            numConnections: numIncomingNamedPipes
          },
          outgoing: {
            name: OUTGOING_PIPE_NAME,
            numConnections: numOutgoingNamedPipes
          }
        },
        webSockets: {
          numConnections: numWebSockets
        },
        pipeName: PIPE_NAME,
        up: new Date(up).toISOString()
      }
    }, null, 2));
  } else if (req.url === '/health.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
  } else {
    res.statusCode = 404;
    res.end(`route not found for ${ req.url }`);
    // proxy.web(req, res, {
    //   changeOrigin: true,
    //   target: BOT_PROXY_TARGET_URL,
    //   ws: true,
    // });
  }
});

const shed = new Watershed();
let ws;

server.on('upgrade', async (res, socket, head) => {
  if (ws) {
    socket.close();
  }

  try {
    ws = shed.accept(res, socket, head);
  } catch (err) {
    console.error(err);
    return socket.end();
  }

  console.log('Accepted a Web Socket tunnel.');

  numWebSockets++;

  let resources = [];

  const shutdown = () => {
    console.log('Shutting down the tunnel.');

    ws = null;
    resources.forEach(resource => resource.close());
    resources = null;
  };

  resources.push(ws.on('end', shutdown));

  resources.push(
    new Server(socket => {
      numIncomingNamedPipes++;
      resources.push(socket);
      ws.on('binary', socket.write.bind(socket));
    }).on('error', shutdown).listen(INCOMING_PIPE_NAME)
  );

  resources.push(
    new Server(socket => {
      numOutgoingNamedPipes++;
      resources.push(socket);
      socket.on('data', ws.send.bind(ws));
    }).on('error', shutdown).listen(OUTGOING_PIPE_NAME)
  );
});

server.listen(PORT, () => console.log(`Bot proxy listening on port ${ PORT }.`));
