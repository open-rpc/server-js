import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import HTTPTransport from "./http";
import { JSONRPCResponse } from "./server-transport";
import connect from "connect";
import http from "http";

describe("http transport", () => {
  let transport: HTTPTransport;
  beforeAll(async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    transport = new HTTPTransport({
      middleware: [],
      port: 9696,
    });

    const router = new Router(simpleMathExample, { mockMode: true });

    transport.addRouter(router);

    await transport.start();
  });

  afterAll(async () => {
    await transport.stop();
  });

  it("can start an http server that works", async () => {
    const { result } = await fetch("http://localhost:9696", {
      body: JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: "addition",
        params: [2, 2],
      }),
      headers: { "Content-Type": "application/json" },
      method: "post",
    }).then((res) => res.json() as Promise<JSONRPCResponse>);

    expect(result).toBe(4);
  });
  it("works with batching", async () => {
    const result = await fetch("http://localhost:9696", {
      body: JSON.stringify([
        {
          id: "0",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }, {
          id: "1",
          jsonrpc: "2.0",
          method: "addition",
          params: [4, 4],
        },
      ]),
      headers: { "Content-Type": "application/json" },
      method: "post",
    }).then((res) => res.json() as Promise<JSONRPCResponse[]>);

    const pluckedResult = result.map((r: JSONRPCResponse) => r.result);
    expect(pluckedResult).toEqual([4, 8]);
  });

  it("allows using an existing app", async () => {
    const app = connect();
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    const localTransport = new HTTPTransport({ middleware: [], port: 9700, app });
    const router = new Router(simpleMathExample, { mockMode: true });
    localTransport.addRouter(router);

    try {
      await localTransport.start();

      const { result } = await fetch("http://localhost:9700", {
        body: JSON.stringify({
          id: "2",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }),
        headers: { "Content-Type": "application/json" },
        method: "post",
      }).then((res) => res.json() as Promise<JSONRPCResponse>);

      expect(result).toBe(4);
    } finally {
      await localTransport.stop();
    }
  }, 30000);

  it("handles errors when stopping the server", async () => {
    const errorTransport = new HTTPTransport({
      middleware: [],
      port: 9703,
    });
    let serverInstance: any;
    let originalCloseFn: ((callback?: (err?: Error) => void) => http.Server) | null = null;

    try {
      await errorTransport.start();
      serverInstance = (errorTransport as any).server;
      originalCloseFn = serverInstance.close.bind(serverInstance);

      const mockError = new Error("Mock close error");
      serverInstance.close = (callback: (err?: Error) => void) => {
        callback(mockError);
        originalCloseFn?.((_err?: Error) => { /* an actual close attempt */ });
      };

      await expect(errorTransport.stop()).rejects.toThrow("Mock close error");

    } finally {
      if (serverInstance && serverInstance.listening) {
        // Restore original close method before attempting to stop for cleanup
        if (originalCloseFn) {
          serverInstance.close = originalCloseFn;
        }
        try {
          await errorTransport.stop(); // Attempt to stop for cleanup
        } catch (cleanupError) {
          // Ignore cleanup errors if the main test assertion passed/failed as expected
          console.warn("Error during test server cleanup (port 9703):", cleanupError);
        }
      }
    }
  });

  it("handles errors when starting the server", async () => {
    const errorTransport = new HTTPTransport({
      middleware: [],
      port: 9707,
    });
    const serverInstance = (errorTransport as any).server;
    const originalListen = serverInstance.listen.bind(serverInstance);
    serverInstance.listen = (port: number, cb: (err?: Error) => void) => {
      cb(new Error("Mock listen error"));
      return serverInstance;
    };
    await expect(errorTransport.start()).rejects.toThrow("Mock listen error");
    serverInstance.listen = originalListen;
    // Do not call stop, since server never started
  });

  it("binds req and res as the this context for methods", async () => {
    // create an app that attaches customProp to req
    const app = connect();
    app.use((req: any, res: any, next: any) => { req.customProp = 'hello'; next(); });
    // set up transport and router with a method that returns this.req.customProp
    const transport = new HTTPTransport({ middleware: [], port: 9710, app });
    const minimalDoc = {
      openrpc: '1.2.6',
      info: { title: 'test', version: '1.0.0' },
      methods: [
        { name: 'getCustom', params: [], result: { name: 'custom', schema: { type: 'string' } } }
      ],
    } as any;
    const mapping = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getCustom: async function(): Promise<any> { return (this as any).req.customProp; }
    };
    const router = new Router(minimalDoc, mapping);
    transport.addRouter(router);
    await transport.start();
    try {
      const { result } = await fetch('http://localhost:9710', {
        body: JSON.stringify({ id: 'foo', jsonrpc: '2.0', method: 'getCustom', params: [] }),
        headers: { 'Content-Type': 'application/json' },
        method: 'post',
      }).then((res) => res.json() as Promise<JSONRPCResponse>);
      expect(result).toBe('hello');
    } finally {
      await transport.stop();
    }
  });
});
