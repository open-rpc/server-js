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
      port: 9706,
    });
    await transport.start();
    const serverInstance = (transport as any).server;
    const originalClose = serverInstance.close.bind(serverInstance);
    serverInstance.close = (cb: (err?: Error) => void) => {
      cb(new Error("Mock close error"));
    };
    await expect(transport.stop()).rejects.toThrow("Mock close error");
    serverInstance.close = originalClose;
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
});
