import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
import WebSocket from "ws";
import WebSocketTransport from "./websocket";
import { JSONRPCResponse } from "./server-transport";
import connect from "connect";

describe("WebSocket transport", () => {

  it("can start an https server that works", async () => {
    expect.assertions(1);
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("wss://localhost:9698", { rejectUnauthorized: false });
    let done: any;
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      void transport.stop();
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      setTimeout(done, 3500); // give ws 3.5 seconds to shutdown
    };
    const handleConnnect = () => {
      ws.off("open", handleConnnect);
      ws.on("message", handleMessage);
      ws.send(JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: "addition",
        params: [2, 2],
      }));
    };
    const prom = new Promise((resolve) => {
      done = resolve;
      ws.on("open", handleConnnect);
    });
    await prom;
  });

  it("can start an https server that works", async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9698", { rejectUnauthorized: false });
    let done: any;
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      void transport.stop();
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      setTimeout(done, 3500); // give ws 3.5 seconds to shutdown
    };
    const handleConnnect = () => {
      ws.off("open", handleConnnect);
      ws.on("message", handleMessage);
      ws.send(JSON.stringify({
        id: "1",
        jsonrpc: "2.0",
        method: "addition",
        params: [2, 2],
      }));
    };
    await new Promise((resolve) => {
      done = resolve;
      ws.on("open", handleConnnect);
    });
  });

  it("works with batching", async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("wss://localhost:9698", { rejectUnauthorized: false });
    let done: any;
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      void transport.stop();
      const result = JSON.parse(data) as JSONRPCResponse[];
      expect(result.map((r) => r.result)).toEqual([4, 8]);
      transport.removeRouter(router);
      setTimeout(done, 3500); // give ws 3.5 seconds to shutdown
    };

    const handleConnnect = () => {
      ws.off("open", handleConnnect);
      ws.on("message", handleMessage);

      ws.send(JSON.stringify([
        {
          id: "2",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }, {
          id: "3",
          jsonrpc: "2.0",
          method: "addition",
          params: [4, 4],
        },
      ]));
    };

    await new Promise((resolve) => {
      done = resolve;
      ws.on("open", handleConnnect);
    });
  });

  it("allows using an existing app (WebSocket)", async () => {
    const app = connect();
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9704,
      app,
    });
    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9704");
    let done: any;
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      void transport.stop();
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      setTimeout(done, 3500); // give ws 3.5 seconds to shutdown
    };
    const handleConnnect = () => {
      ws.off("open", handleConnnect);
      ws.on("message", handleMessage);
      ws.send(JSON.stringify({
        id: "custom-app",
        jsonrpc: "2.0",
        method: "addition",
        params: [2, 2],
      }));
    };
    await new Promise((resolve) => {
      done = resolve;
      ws.on("open", handleConnnect);
    });
  }, 30000);

  it("handles errors when starting the server (WebSocket)", async () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9705,
    });
    const serverInstance = (transport as any).server;
    const originalListen = serverInstance.listen.bind(serverInstance);
    serverInstance.listen = (port: number, cb: (err?: Error) => void) => {
      cb(new Error("Mock listen error"));
      return serverInstance;
    };
    await expect(transport.start()).rejects.toThrow("Mock listen error");
    serverInstance.listen = originalListen;
    // Do not call stop, since server never started
  });

  it("handles errors when stopping the server (WebSocket)", async () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 0,
    });
    await transport.start();
    const serverInstance = (transport as any).server;
    const originalClose = serverInstance.close.bind(serverInstance);
    serverInstance.close = (cb: (err?: Error) => void) => {
      cb(new Error("Mock close error"));
    };
    try {
      await expect(transport.stop()).rejects.toThrow("Mock close error");
    } finally {
      serverInstance.close = originalClose;
      await new Promise<void>((resolve, reject) => {
        serverInstance.close((err?: Error) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  });

  it("properly terminates sockets in OPEN state during stop", async () => {
    // Create a transport without actually starting the server
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9707,
    });
    
    // Create a mock WebSocket.Server with the necessary properties
    const mockWss = {
      clients: new Set(),
      close: jest.fn((cb) => cb()),
      removeAllListeners: jest.fn()
    };
    
    // Replace the transport's WebSocket.Server with our mock
    (transport as any).wss = mockWss;
    
    // Create a mock socket in OPEN state
    const mockOpenSocket = {
      close: jest.fn(),
      terminate: jest.fn(),
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      readyState: WebSocket.OPEN
    };
    
    // Add the mock socket to our clients collection
    mockWss.clients.add(mockOpenSocket);
    
    // Replace the transport's server.close with a mock implementation
    const mockServer = {
      close: jest.fn((cb) => cb())
    };
    (transport as any).server = mockServer;
    
    // Call stop - this should invoke our mock implementations
    await transport.stop();
    
    // Verify the socket was first closed softly and then terminated
    expect(mockOpenSocket.close).toHaveBeenCalled();
    expect(mockOpenSocket.terminate).toHaveBeenCalled();
    expect(mockWss.removeAllListeners).toHaveBeenCalled();
    expect(mockWss.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });

  it("properly terminates sockets in CLOSING state during stop", async () => {
    // Create a transport without actually starting the server
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9708,
    });
    
    // Create a mock WebSocket.Server with the necessary properties
    const mockWss = {
      clients: new Set(),
      close: jest.fn((cb) => cb()),
      removeAllListeners: jest.fn()
    };
    
    // Replace the transport's WebSocket.Server with our mock
    (transport as any).wss = mockWss;
    
    // Create a mock socket in CLOSING state
    const mockClosingSocket = {
      close: jest.fn(),
      terminate: jest.fn(),
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      readyState: WebSocket.CLOSING
    };
    
    // Add the mock socket to our clients collection
    mockWss.clients.add(mockClosingSocket);
    
    // Replace the transport's server.close with a mock implementation
    const mockServer = {
      close: jest.fn((cb) => cb())
    };
    (transport as any).server = mockServer;
    
    // Call stop - this should invoke our mock implementations
    await transport.stop();
    
    // Verify the socket was first closed softly and then terminated
    expect(mockClosingSocket.close).toHaveBeenCalled();
    expect(mockClosingSocket.terminate).toHaveBeenCalled();
    expect(mockWss.removeAllListeners).toHaveBeenCalled();
    expect(mockWss.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });

  it("does not terminate sockets that are already closed", async () => {
    // Create a transport without actually starting the server
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9709,
    });
    
    // Create a mock WebSocket.Server with the necessary properties
    const mockWss = {
      clients: new Set(),
      close: jest.fn((cb) => cb()),
      removeAllListeners: jest.fn()
    };
    
    // Replace the transport's WebSocket.Server with our mock
    (transport as any).wss = mockWss;
    
    // Create a mock socket in CLOSED state
    const mockClosedSocket = {
      close: jest.fn(),
      terminate: jest.fn(),
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED,
      readyState: WebSocket.CLOSED
    };
    
    // Add the mock socket to our clients collection
    mockWss.clients.add(mockClosedSocket);
    
    // Replace the transport's server.close with a mock implementation
    const mockServer = {
      close: jest.fn((cb) => cb())
    };
    (transport as any).server = mockServer;
    
    // Call stop - this should invoke our mock implementations
    await transport.stop();
    
    // Verify close was called but terminate was not
    expect(mockClosedSocket.close).toHaveBeenCalled();
    expect(mockClosedSocket.terminate).not.toHaveBeenCalled();
    expect(mockWss.removeAllListeners).toHaveBeenCalled();
    expect(mockWss.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });

  it("applies default timeout when none provided", () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9710,
    });
    expect((transport as any).options.timeout).toBe(3000);
  });

  it("respects provided timeout", () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9711,
      timeout: 5000,
    });
    expect((transport as any).options.timeout).toBe(5000);
  });

  it("passes a client proxy into method handlers", async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    (simpleMathExample.methods as any[]).push({
      name: "notify",
      params: [{ name: "value", schema: { type: "integer" } }],
      result: { name: "notified", schema: { type: "integer" } },
      "x-implemented-by": ["client"],
    });

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9712,
    });

    const router = new Router(simpleMathExample, {
      addition: async (a: number, b: number, client: { notify: (value: number) => Promise<number> }) => {
        return client.notify(a + b);
      },
      subtraction: async (a: number, b: number) => a - b,
      notify: async () => 0,
    });

    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9712");

    await new Promise<void>((resolve, reject) => {
      ws.on("message", (raw: WebSocket.Data) => {
        const payload = JSON.parse(raw.toString());
        if (payload.method === "notify") {
          ws.send(JSON.stringify({
            id: payload.id,
            jsonrpc: "2.0",
            result: payload.params[0] * 2,
          }));
          return;
        }

        expect(payload.result).toBe(8);
        resolve();
      });
      ws.on("error", reject);
      ws.on("open", () => {
        ws.send(JSON.stringify({
          id: "invoke-addition",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }));
      });
    });

    ws.close();
    await transport.stop();
  });

  it("runs outboundHandler with connected clients", async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    (simpleMathExample.methods as any[]).push({
      name: "notify",
      params: [{ name: "value", schema: { type: "integer" } }],
      result: { name: "notified", schema: { type: "integer" } },
      "x-implemented-by": ["client"],
    });

    let hasSentNotify = false;
    const outboundHandler = jest.fn(async (clients) => {
      if (clients.length === 0 || hasSentNotify) {
        return;
      }
      hasSentNotify = true;
      await clients[0].methods.notify(10);
    });

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9713,
      outboundHandler,
      outboundIntervalMs: 50,
    });

    const router = new Router(simpleMathExample, {
      addition: async (a: number, b: number) => a + b,
      subtraction: async (a: number, b: number) => a - b,
      notify: async () => 0,
    });

    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9713");
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (raw: WebSocket.Data) => {
        const payload = JSON.parse(raw.toString());
        if (payload.method === "notify") {
          ws.send(JSON.stringify({
            id: payload.id,
            jsonrpc: "2.0",
            result: payload.params[0],
          }));
          resolve();
        }
      });
      ws.on("error", reject);
    });

    expect(outboundHandler).toHaveBeenCalled();
    ws.close();
    await transport.stop();
  });


  it("rejects handler client proxy calls when client returns JSON-RPC error", async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    (simpleMathExample.methods as any[]).push({
      name: "notify",
      params: [{ name: "value", schema: { type: "integer" } }],
      result: { name: "notified", schema: { type: "integer" } },
      "x-implemented-by": ["client"],
    });

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9714,
    });

    const router = new Router(simpleMathExample, {
      addition: async (a: number, b: number, client: { notify: (value: number) => Promise<number> }) => {
        return client.notify(a + b);
      },
      subtraction: async (a: number, b: number) => a - b,
      notify: async () => 0,
    });

    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9714");

    await new Promise<void>((resolve, reject) => {
      ws.on("message", (raw: WebSocket.Data) => {
        const payload = JSON.parse(raw.toString());
        if (payload.method === "notify") {
          ws.send(JSON.stringify({
            id: payload.id,
            jsonrpc: "2.0",
            error: {
              code: 1234,
              message: "client side failure",
              data: { reason: "boom" },
            },
          }));
          return;
        }

        expect(payload.error).toBeDefined();
        expect(payload.error.code).toBe(6969);
        resolve();
      });
      ws.on("error", reject);
      ws.on("open", () => {
        ws.send(JSON.stringify({
          id: "invoke-addition-error",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }));
      });
    });

    ws.close();
    await transport.stop();
  });

  it("cleans up pending client requests when socket closes", async () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9715,
    });

    const reject = jest.fn();
    const resolve = jest.fn();
    const mockSocket = {
      removeAllListeners: jest.fn(),
    };

    (transport as any).pendingClientRequests.set("request-1", {
      socket: mockSocket,
      reject,
      resolve,
    });
    (transport as any).clientDetails.set(mockSocket, { id: "client-1", methods: {} });

    (transport as any).handleClientClose(mockSocket);

    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(reject).toHaveBeenCalledWith(new Error("WebSocket connection closed"));
    expect((transport as any).pendingClientRequests.size).toBe(0);
    expect((transport as any).clientDetails.size).toBe(0);
  });

  it("does not resolve pending client requests when response id is missing", () => {
    const transport = new WebSocketTransport({
      middleware: [],
      port: 9716,
    });

    const reject = jest.fn();
    const resolve = jest.fn();
    (transport as any).pendingClientRequests.set("request-2", {
      socket: {},
      reject,
      resolve,
    });

    (transport as any).resolvePendingClientRequest({
      jsonrpc: "2.0",
      result: "ok",
    });

    expect(resolve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
    expect((transport as any).pendingClientRequests.size).toBe(1);
  });

});
