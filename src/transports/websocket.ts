import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http2, { ServerOptions, Http2SecureServer, SecureServerOptions } from "http2";
import ServerTransport from "./server-transport";
import { IncomingMessage } from "http";
import WebSocket from "ws";
import { Server } from "https";

export interface IWebSocketServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
}

export default class WebSocketServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer;
  private wss: WebSocket.Server;

  constructor(private options: IWebSocketServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = connect();

    const corsOptions = options.cors || WebSocketServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser(),
        ...options.middleware,
      ],
    };

    this.options.middleware.forEach((mw) => app.use(mw));

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
