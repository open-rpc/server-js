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
});
