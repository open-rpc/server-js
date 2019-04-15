import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http2, { ServerOptions, Http2SecureServer, SecureServerOptions } from "http2";
import ServerTransport from "./server-transport";
import { IncomingMessage } from "http";
import WebSocket from "ws";
import { Server } from "https";

export type TWebSocketServerTransportOptions = {
  middleware: HandleFunction[],
  port: number,
  allowHTTP1?: boolean,
} & SecureServerOptions;

export default class WebSocketServerTransport extends ServerTransport {
  private server: Http2SecureServer;
  private wss: WebSocket.Server;

  constructor(private options: TWebSocketServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = connect();
    const corsOptions = { origin: "*" } as cors.CorsOptions;

    app.use(cors(corsOptions) as HandleFunction);
    app.use(jsonParser());
    this.server = http2.createSecureServer(options, (req: any, res: any) => app(req, res));
    this.wss = new WebSocket.Server({ server: this.server as Server });

    this.wss.on("connection", (ws) => {
      ws.on(
        "message",
        (message: string) => this.webSocketRouterHandler(JSON.parse(message), ws.send.bind(ws)),
      );
    });
  }

  public start() {
    this.server.listen(this.options.port);
  }

  private async webSocketRouterHandler(req: any, respondWith: any) {
    const result = await super.routerHandler(req.id, req.method, req.params);
    respondWith(JSON.stringify(result));
  }
}
