import examples from "@open-rpc/examples";
import { parse } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
import { IpcServerTransport } from "./ipc";
import ipc from "node-ipc";

describe("IPC transport", () => {
  it("can start an IPC server that works", async (done) => {
    const simpleMathExample = await parse(JSON.stringify(examples.simpleMath));

    const ipcTransport = new IpcServerTransport({
      id: "simpleMath",
      port: 9699,
      udp: false,
      ipv6: false,
    });
    const router = new Router(simpleMathExample, { mockMode: true });
    ipcTransport.addRouter(router);
    ipcTransport.start();

    ipc.config.id = "simpleMath";
    ipc.config.retry = 1500;

    ipc.connectToNet(
      "simpleMath",
      "127.0.0.1",
      9699,
      () => {
        ipc.of.simpleMath.on("connect", () => {
          ipc.of.simpleMath.emit(
            "message",
            JSON.stringify({
              id: "0",
              jsonrpc: "2.0",
              method: "addition",
              params: [2, 2],
            }),
          );
        });

        ipc.of.simpleMath.on(
          "message",
          (data: any) => {
            const { result } = JSON.parse(data);
            expect(result).toBe(4);
            done();
          },
        );
      },
    );
  });
});
