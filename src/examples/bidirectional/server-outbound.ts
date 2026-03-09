import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";
import { Router } from "../../router";
import WebSocketTransport, { ConnectedClient } from "../../transports/websocket";
import bidirectionalOpenRPCDocument from "./openrpc";

const PORT = 9851;

async function startOutboundServer() {
  const openrpcDocument = await parseOpenRPCDocument(
    JSON.stringify(bidirectionalOpenRPCDocument),
  ) as OpenRPC;

  const router = new Router(openrpcDocument, {
    serverHello: async (name: string) => `Hello ${name} (from outbound server).`,
    bounce: async (text: string) => `[outbound server bounce] ${text}`,
    serverCallsClient: async (
      name: string,
      client: {
        clientHello: (value: string) => Promise<string>;
        bounce: (value: string) => Promise<string>;
      },
    ) => {
      const helloFromClient = await client.clientHello(name);
      const bounceFromClient = await client.bounce(`request/response ping for ${name}`);
      return `Request/response path -> ${helloFromClient} | ${bounceFromClient}`;
    },
  });

  const outboundHandler = async (clients: ConnectedClient[]) => {
    await Promise.all(clients.map(async (client) => {
      try {
        const message = await client.methods.bounce("scheduled ping from outboundHandler");
        console.log(`[outboundHandler] ${client.id}: ${String(message)}`);
      } catch (err) {
        console.error(`[outboundHandler] failed for ${client.id}:`, err);
      }
    }));
  };

  const transport = new WebSocketTransport({
    middleware: [],
    port: PORT,
    outboundHandler,
    outboundIntervalMs: 2000,
  });

  transport.addRouter(router);
  await transport.start();
  console.log(`OutboundHandler example server listening on ws://localhost:${PORT}`);

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

void startOutboundServer().catch((err) => {
  console.error("Failed to start outbound example server:", err);
  process.exit(1);
});
