# OpenRPC Server JS

JSON-RPC 2.0 Server implementation that supports multiple transport protocols. Built to run with node 10+.

Inspired by [mole-rpc](https://github.com/koorchik/node-mole-rpc), built for OpenRPC.

## Features

 - [x] Multiple Transports
   - [x] HTTP1/2
   - [x] HTTPS1/2
   - [x] WebSockets
   - [x] IPC
 - [x] Automatically Validate JSON Schemas for [ContentDescriptor#schemas](https://spec.open-rpc.org/#content-descriptor-schema) [MethodObject#params](https://spec.open-rpc.org/#method-result).
 - [x] Automatic testing against [MethodObject#examplePairings](https://spec.open-rpc.org/#method-example-pairings).

## How to Use

### CLI

#### Install

```bash
npm install -g @open-rpc/server-js
```

#### Setup handlers for AutoRouter

```bash
mkdir ./method-handlers
echo "export default (a, b) => a - b;" > ./method-handlers/subtraction.js
echo "export default (a, b) => a + b;" > ./method-handlers/addition.js
```

#### Setup simple confg file

```bash
echo "{ \"transportOptions\": { \"HTTPServerTransportOptions\": { \"port\": 8080 } } }" > open-rpc-server.config.json
```

#### Start the server
```bash
open-rpc-server-js \
  -c ./open-rpc-server.config.json \
  -h ./method-handlers \
  -s https://raw.githubusercontent.com/open-rpc/examples/master/service-descriptions/simple-math-openrpc.json
```

Thats it!

### Javascript/Typescript API

#### Install

```bash
npm install -g @open-rpc/server-node
```

#### Creating Routers

##### using method mapping and OpenRPC document

```typescript
import { types } from "@open-rpc/meta-schema";
import { Router } from "node-json-rpc-server";

const openrpcDocument = {
  openrpc: "1.0.0",
  info: {
    title: "node-json-rpc-server example",
    version: "1.0.0"
  },
  methods: [
    {
      name: "addition",
      params: [
        { name: "a", schema: { type: "integer" } },
        { name: "b", schema: { type: "integer" } }
      ],
      result: {
        { name: "c", schema: { type: "integer" } }
      }
    }
  ]
} as types.OpenRPC;

const methodHandlerMapping = {
  addition: (a: number, b: number) => a + b
};

const router = new Router(openrpcDocument, methodHandlerMapping);
```

##### mock mode

```typescript
const router = new Router(openrpcDocument, { mockMode: true });
```

#### Creating Transports

##### IPC

```typescript
import { TCPIPCServerTranport, UDPIPCServerTranport } from "node-json-rpc-server";

const ipcOptions = { maxConnetions: 20 }; // https://www.npmjs.com/package/node-ipc#ipc-config
const TCPIPCOptions = { ...ipcOptions, networkPort: 4343 };
const UDPIPCOptions = { ...ipcOptions, networkPort: 4343, udp: true };

const tcpIpcTransport = new IPCServerTranport(TCPIPCTransportOptions);
const UdpIpcTransport = new IPCServerTranport(UDPIPCTransportOptions);
```

##### HTTP/S

```
import { HTTPServerTransport, HTTPSServerTransport } from "node-json-rpc-server";

const httpOptions = {
  middleware: [ cors({ origin: "*" }) ],
  port: 4345
};
const httpsOptions = { // extends https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
  middleware: [ cors({ origin: "*" }) ],
  port: 4346,
  key: await fs.readFile("test/fixtures/keys/agent2-key.pem"),
  cert: await fs.readFile("test/fixtures/keys/agent2-cert.pem"),
  ca: fs.readFileSync("ssl/ca.crt")
};

const httpTransport = new HTTPServerTransport(httpOptions);
const httpsTransport = new HTTPSServerTransport(httpsOptions); // Defaults to using HTTP2, allows HTTP1.
```

##### WebSockets

```
import { WebSocketServerTransport } from "node-json-rpc-server";

const webSocketFromHttpsOptions = { // extends https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
  server: httpsTransport.server
};

const webSocketOptions = { // extends https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
  port: 4347
};
const wsFromHttpsTransport = new WebSocketServerTransport(webSocketFromHttpsOptions); // Accepts http transport as well.
const wsTransport = new WebSocketServerTransport(webSocketOptions); // Accepts http transport as well.
```

#### Creating the server

##### With everything known upfront

```typescript
import { Server } from "node-json-rpc-server";

const options = {
  router: router,
  transports: [
    tcpIpcTransport,
    udpIpcTransport,
    httpTransport,
    httpsTransport,
    wsFromHttpsTransport,
    wsTransport
  ]
};

const server = new Server(options);

server.start();
```

##### Add components as you go
```
const server = new Server();
server.start();

server.addTransport(httpsTransport); // will be started immediately
server.setRouter(router);
server.addTransports([ wsTransport, wsFromHttpsTransport, httpsTransport ]); // will be started immediately.
```
