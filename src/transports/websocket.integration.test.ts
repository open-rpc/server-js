import WebSocket from "ws";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";
import WebSocketTransport from "./websocket";
import { Router } from "../router";

describe("websocket integration", () => {
  jest.setTimeout(15000);

  it("supports bidirectional calls over websocket", async () => {
    const openrpcDocument = await parseOpenRPCDocument(JSON.stringify({
      openrpc: "1.2.6",
      info: {
        title: "WebSocket integration test",
        version: "1.0.0",
      },
      methods: [
        {
          name: "add",
          params: [
            { name: "a", schema: { type: "number" } },
            { name: "b", schema: { type: "number" } },
          ],
          result: { name: "sum", schema: { type: "number" } },
          "x-implementedBy": ["server"],
        },
        {
          name: "clientDouble",
          params: [{ name: "value", schema: { type: "number" } }],
          result: { name: "doubled", schema: { type: "number" } },
          "x-implementedBy": ["client"],
        },
        {
          name: "callClientDouble",
          params: [{ name: "value", schema: { type: "number" } }],
          result: { name: "result", schema: { type: "number" } },
          "x-implementedBy": ["server"],
        },
      ],
    })) as OpenRPC;

    const transport = new WebSocketTransport({
      middleware: [],
      port: 9720,
    });

    const router = new Router(openrpcDocument, {
      add: async (a: number, b: number) => a + b,
      callClientDouble: async (
        value: number,
        client: { clientDouble: (input: number) => Promise<number> },
      ) => client.clientDouble(value),
      clientDouble: async () => 0,
    });

    transport.addRouter(router);
    await transport.start();

    const ws = new WebSocket("ws://localhost:9720");

    const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    let nextRequestId = 0;

    const sendRequest = (method: string, params: any[]) => new Promise<any>((resolve, reject) => {
      const id = `client-${nextRequestId++}`;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, jsonrpc: "2.0", method, params }));
    });

    const messageHandler = (raw: WebSocket.Data) => {
      const payload = JSON.parse(raw.toString());

      if (payload.method === "clientDouble") {
        ws.send(JSON.stringify({
          id: payload.id,
          jsonrpc: "2.0",
          result: payload.params[0] * 2,
        }));
        return;
      }

      if (payload.id && (payload.result !== undefined || payload.error)) {
        const pendingRequest = pending.get(payload.id);
        if (!pendingRequest) {
          return;
        }
        pending.delete(payload.id);

        if (payload.error) {
          pendingRequest.reject(new Error(payload.error.message));
          return;
        }

        pendingRequest.resolve(payload.result);
      }
    };

    ws.on("message", messageHandler);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    try {
      const sum = await sendRequest("add", [2, 3]);
      expect(sum).toBe(5);

      const doubled = await sendRequest("callClientDouble", [7]);
      expect(doubled).toBe(14);
    } finally {
      ws.removeListener("message", messageHandler);
      ws.close();
      await transport.stop();
    }
  });
});
