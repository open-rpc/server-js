import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
import HTTPSTransport from "./https";
const readFile = promisify(fs.readFile);
import https from "https";
import cors from "cors";
import { json as jsonParser } from "body-parser";
import { HandleFunction } from "connect";
import { JSONRPCResponse } from "./server-transport";
import { Agent } from 'undici';

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

    transport.start();
  });

  afterAll(() => {
    transport.stop();
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
});
