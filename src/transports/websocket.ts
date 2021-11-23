import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http2, { Http2SecureServer, SecureServerOptions } from "http2";
import http from "http";
import ServerTransport, { JSONRPCRequest } from "./server-transport";
import WebSocket from "ws";

export interface WebSocketServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
}

export default class WebSocketServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer | http.Server;
  private wss: WebSocket.Server;

  constructor(private options: WebSocketServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = connect();

    const corsOptions =
      options.cors || WebSocketServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser({
          limit: "1mb",
        }),
        ...options.middleware,
      ],
    };

    this.options.middleware.forEach((mw) => app.use(mw));

    if (!this.options.cert && !this.options.key) {
      this.server = http.createServer((req: any, res: any) => app(req, res));
    } else {
      this.server = http2.createSecureServer(options, (req: any, res: any) =>
        app(req, res)
      );
    }
    this.wss = new WebSocket.Server({ server: this.server as any });

    this.setupEventHandlers();
  }

  public start() {
    this.server.listen(this.options.port);
  }

  public stop() {
    this.wss.removeAllListeners();
    this.wss.close();
    this.server.close();
  }

  private async webSocketRouterHandler(req: any, respondWith: any) {
    let result = null;
    if (req instanceof Array) {
      result = await Promise.all(
        req.map((r: JSONRPCRequest) => super.routerHandler(r))
      );
    } else {
      result = await super.routerHandler(req);
    }
    respondWith(JSON.stringify(result));
  }

  private onMessage(ws: WebSocket, message: string) {
    try {
      return this.webSocketRouterHandler(
        JSON.parse(message),
        ws.send.bind(ws)
      );
    } catch (e) {
      ws.send(
        JSON.stringify({
          id: 0,
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: `Message failure: ${e.toString()}`,
          },
        })
      );
      return undefined;
    }
  }

  private setupEventHandlers() {
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", (message: string) => this.onMessage(ws, message));
      ws.on("close", () => ws.removeAllListeners());
    });
  }
}
