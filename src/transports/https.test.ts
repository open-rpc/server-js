import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
import HTTPSTransport from "./https";
const readFile = promisify(fs.readFile);
import cors from "cors";
import { json as jsonParser } from "body-parser";
import { HandleFunction } from "connect";
import { JSONRPCResponse } from "./server-transport";
import { Agent } from 'undici';
import connect from "connect";

const agent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
}) as any;
describe("https transport", () => {
  let transport: HTTPSTransport;
  beforeAll(async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const corsOptions = { origin: "*" } as cors.CorsOptions;

    transport = new HTTPSTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser(),
      ],
      port: 9697,
    });

    const router = new Router(simpleMathExample, { mockMode: true });

    transport.addRouter(router);

    await transport.start();
  });

  afterAll(async () => {
    await transport.stop();
  });

  it("can start an https server that works", async () => {
    const { result } = await fetch("https://localhost:9697", {
      dispatcher: agent,
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
    const result = await fetch("https://localhost:9697", {
      dispatcher: agent,
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

  it("allows using an existing app (HTTPS)", async () => {
    const app = connect();
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    const transport = new HTTPSTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9701,
      app,
    });
    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    try {
      await transport.start();
      const { result } = await fetch("https://localhost:9701", {
        dispatcher: agent,
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
      await transport.stop();
    }
  }, 30000);

  it("handles errors when starting the server (HTTPS)", async () => {
    const transport = new HTTPSTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9708,
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

  it("handles errors when stopping the server (HTTPS)", async () => {
    const transport = new HTTPSTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9709, // Using a new port to avoid conflicts
    });
    await transport.start(); // Start the server first

    const serverInstance = (transport as any).server;
    const originalClose = serverInstance.close.bind(serverInstance);
    serverInstance.close = (cb: (err?: Error) => void) => {
      cb(new Error("Mock close error"));
      // REAL http2.Http2SecureServer.close() returns the server instance.
      // we need to return something that has a .close method for the promisify to work.
      // but it doesnt matter since we are testing the error case.
      return serverInstance;
    };
    await expect(transport.stop()).rejects.toThrow("Mock close error");
    serverInstance.close = originalClose; // Restore original close
    // Attempt to gracefully close the server if the mock wasn't called or test failed before mock.
    // This might not be strictly necessary if the test passes and mock is restored.
    try {
      await new Promise<void>((resolve, reject) => {
        const s = (transport as any).server as any;
        if (s && s.listening) {
          s.close((err?: Error) => err ? reject(err) : resolve());
        } else {
          resolve();
        }
      });
    } catch (e) {
      // ignore errors during cleanup
    }
  });
});
