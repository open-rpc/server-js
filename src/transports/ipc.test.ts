import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import IPCTransport from "./ipc";
import ipc from "node-ipc";
import { JSONRPCResponse } from "./server-transport";

describe.only("IPC transport", () => {
  let transport: IPCTransport;
  beforeAll(async () => {
    console.log("starting beforeAll");
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    console.log("Dereffed");
    transport = new IPCTransport({
      id: "simpleMath",
      ipv6: false,
      port: 9699,
      udp: false,
    });
    console.log("created IPC");
    ipc.config.id = "simpleMath";
    ipc.config.retry = 1500;
    const router = new Router(simpleMathExample, { mockMode: true });
    transport.addRouter(router);
    transport.start();
    console.log("started transport");
    return new Promise((resolve, reject) => {
      console.log("Im inside the promis");
      ipc.connectToNet(
        "simpleMath",
        "127.0.0.1",
        9699,
        () => {
          ipc.of.simpleMath.on("connect", resolve);
        });
    });
  });

  afterAll(() => {
    ipc.disconnect("simpleMath");
    transport.stop();
  });

  it("can start an IPC server that works", (done) => {
    const handle = (data: any) => {
      ipc.of.simpleMath.off("message", handle);
      const { result } = JSON.parse(data);
      expect(result).toBe(4);
      done();
    };
    console.log(ipc.of);

    ipc.of.simpleMath.on("message", handle);

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

  it("works with batching", (done) => {
    const handle = (data: any) => {
      ipc.of.simpleMath.off("message", handle);
      const result = JSON.parse(data) as JSONRPCResponse[];
      expect(result.map((r) => r.result)).toEqual([4, 8]);
      done();
    };

    ipc.of.simpleMath.on("message", handle);

    ipc.of.simpleMath.emit(
      "message",
      JSON.stringify([
        {
          id: "1",
          jsonrpc: "2.0",
          method: "addition",
          params: [2, 2],
        }, {
          id: "2",
          jsonrpc: "2.0",
          method: "addition",
          params: [4, 4],
        },
      ]),
    );
  });
});
