import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
import https from "https";
import WebSocket from "ws";
import WebSocketTransport from "./websocket";
import { IJSONRPCResponse } from "./server-transport";

describe("WebSocket transport", () => {

  it("can start an https server that works", async (done) => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    transport.start();

    const ws = new WebSocket("wss://localhost:9698", { rejectUnauthorized: false });
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      transport.stop();
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      done();
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
    ws.on("open", handleConnnect);
  });

  it("can start an https server that works", async (done) => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    transport.start();

    const ws = new WebSocket("ws://localhost:9698", { rejectUnauthorized: false });
    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      transport.stop();
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      done();
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
    ws.on("open", handleConnnect);
  });

  it("works with batching", async (done) => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const transport = new WebSocketTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    transport.start();

    const ws = new WebSocket("wss://localhost:9698", { rejectUnauthorized: false });

    const handleMessage = (data: string) => {
      ws.off("message", handleMessage);
      transport.stop();
      const result = JSON.parse(data) as IJSONRPCResponse[];
      expect(result.map((r) => r.result)).toEqual([4, 8]);
      transport.removeRouter(router);
      done();
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
    ws.on("open", handleConnnect);
  });
});
