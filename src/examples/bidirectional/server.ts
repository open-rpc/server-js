import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";
import { Router } from "../../router";
import WebSocketTransport from "../../transports/websocket";
import bidirectionalOpenRPCDocument from "./openrpc";

const PORT = 9850;

async function startServer() {
  const openrpcDocument = await parseOpenRPCDocument(
    JSON.stringify(bidirectionalOpenRPCDocument),
  ) as OpenRPC;

  const router = new Router(openrpcDocument, {
    serverHello: async (name: string) => `Hello ${name} (from server).`,
    bounce: async (text: string) => `[server bounce] ${text}`,
    serverCallsClient: async (
      name: string,
      client: {
        clientHello: (value: string) => Promise<string>;
        bounce: (value: string) => Promise<string>;
      },
    ) => {
      const helloFromClient = await client.clientHello(name);
      const bounceFromClient = await client.bounce(`ping from server for ${name}`);
      return `Server called client -> ${helloFromClient} | ${bounceFromClient}`;
    },
  });

  const transport = new WebSocketTransport({
    middleware: [],
    port: PORT,
  });

  transport.addRouter(router);
  await transport.start();
  console.log(`Bidirectional example server listening on ws://localhost:${PORT}`);

  const shutdown = async () => {
    await transport.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

void startServer().catch((err) => {
  console.error("Failed to start bidirectional example server:", err);
  process.exit(1);
});
