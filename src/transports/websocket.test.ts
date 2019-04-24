import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
import https from "https";
import WebSocket from "ws";
import WebSocketTransport from "./websocket";

const agent = new https.Agent({ rejectUnauthorized: false });

describe("WebSocket transport", () => {
  it("can start an https server that works", async (done) => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);

    const webSocketTransport = new WebSocketTransport({
      cert: await readFile(`${process.cwd()}/test-cert/server.cert`),
      key: await readFile(`${process.cwd()}/test-cert/server.key`),
      middleware: [],
      port: 9698,
    });

    const router = new Router(simpleMathExample, { mockMode: true });

    webSocketTransport.addRouter(router);

    webSocketTransport.start();

    const ws = new WebSocket("wss://localhost:9698", { rejectUnauthorized: false });

    ws.on("open", function open() {
      ws.send(JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: "addition",
        params: [2, 2],
      }));
    });

    ws.on("message", (data: string) => {
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      done();
    });
  });
});
