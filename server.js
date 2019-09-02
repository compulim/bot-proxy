require('dotenv/config');

const { Server } = require('net');
const http = require('http');
const prettyMs = require('pretty-ms');
const WebSocket = require('ws');

const {
  PIPE_NAME = 'bfv4.pipes',
  PORT = 80
} = process.env;

const {
  INCOMING_PIPE_NAME = `\\\\.\\pipe\\${ PIPE_NAME }.incoming`,
  OUTGOING_PIPE_NAME = `\\\\.\\pipe\\${ PIPE_NAME }.outgoing`
} = process.env;

let numIncomingNamedPipes = 0;
let numOutgoingNamedPipes = 0;
let numWebSockets = 0;
let webSocketUp = 0;
const up = Date.now();

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const message = `Bot Proxy is up since ${ prettyMs(Date.now() - up) } ago. ${ shutdown ? `A client is connected ${ prettyMs(Date.now() - webSocketUp) } ago.` : 'No client is connected.' }`;
    const separator = new Array(message.length).fill('-').join('');

    res.setHeader('Content-Type', 'text/plain');
    res.end(JSON.stringify({
      human: [
        separator,
        message,
        separator
      ],
      computer: {
        botConnected: !!shutdown,
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
          numConnections: numWebSockets,
          up: new Date(webSocketUp).toISOString()
        },
        pipeName: PIPE_NAME,
        up: new Date(up).toISOString()
      }
    }, null, 2));
  } else if (req.url === '/health.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
  } else if (req.url === '/kill') {
    if (shutdown) {
      console.log('Killing Web Socket connection.');
      shutdown();
    }
  } else if (req.url === '/kill?force') {
    process.exit(-1);
  } else {
    res.statusCode = 404;
    res.end(`bot-proxy: route not found for ${ req.url }`);
    // proxy.web(req, res, {
    //   changeOrigin: true,
    //   target: BOT_PROXY_TARGET_URL,
    //   ws: true,
    // });
  }
});

const wss = new WebSocket.Server({ server });

let shutdown;

wss.on('connection', ws => {
  if (shutdown) {
    console.log('Web Socket connection already established, killing existing one.');
    shutdown();
  }

  console.log(`Accepted a Web Socket tunnel.`);

  webSocketUp = Date.now();
  numWebSockets++;

  let unsubscribes = [];

  shutdown = () => {
    if (unsubscribes) {
      console.log('Shutting down the tunnel.');

      shutdown = null;

      unsubscribes.forEach(unsubscribe => unsubscribe());
      unsubscribes = null;
    }
  };

  unsubscribes.push(ws.on('end', shutdown).close.bind(ws));

  const incomingServer = new Server(socket => {
    console.log(`Accepting an incoming named pipe at ${ INCOMING_PIPE_NAME }.`);

    numIncomingNamedPipes++;
    unsubscribes.push(socket.destroy.bind(socket));

    socket.on('data', buffer => {
      try {
        console.log(`NP->WS: ${ buffer.toString() }`);
        ws.send(buffer);
      } catch (err) {
        console.error('bot-proxy: failed when NP->WS.');
        console.error(err);
        shutdown();
      }
    });
  }).on('error', shutdown).listen(INCOMING_PIPE_NAME);

  unsubscribes.push(incomingServer.close.bind(incomingServer));

  const outgoingServer = new Server(socket => {
    console.log(`Accepting an outgoing named pipe at ${ OUTGOING_PIPE_NAME }.`);

    numOutgoingNamedPipes++;
    unsubscribes.push(socket.destroy.bind(socket));

    ws.on('message', buffer => {
      try {
        console.log(`WS->NP: ${ buffer.toString() }`);
        socket.write(buffer);
      } catch (err) {
        console.error('bot-proxy: failed when WS->NP.');
        console.error(err);
        shutdown();
      }
    });
  }).on('error', shutdown).listen(OUTGOING_PIPE_NAME);

  unsubscribes.push(outgoingServer.close.bind(outgoingServer));
});

server.listen(PORT, () => console.log(`Bot proxy listening on port ${ PORT }.`));
