import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction, Server as ConnectApp } from "connect";
import http2, { Http2SecureServer, SecureServerOptions } from "http2";
import http from "http";
import ServerTransport, { JSONRPCRequest } from "./server-transport";
import WebSocket from "ws";

export interface WebSocketServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
  app?: ConnectApp;
  timeout?: number = 3000;
}

export default class WebSocketServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer | http.Server;
  private wss: WebSocket.Server;

  constructor(private options: WebSocketServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = options.app || connect();

    const corsOptions = options.cors || WebSocketServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
      app,
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser({
          limit: "1mb"
        }),
        ...options.middleware,
      ],
    };

    this.options.middleware.forEach((mw) => app.use(mw));

    if (!this.options.cert && !this.options.key) {
      this.server = http.createServer((req: any, res: any) => app(req, res));
    } else {
      this.server = http2.createSecureServer(options, (req: any, res: any) => app(req, res));
    }
    this.wss = new WebSocket.Server({ server: this.server as any });

    this.wss.on("connection", (ws: WebSocket) => {
      ws.on(
        "message",
        (message: string) => this.webSocketRouterHandler(JSON.parse(message), ws.send.bind(ws)),
      );
      ws.on("close", () => ws.removeAllListeners());
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (err?: Error) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    // First sweep, soft close
    this.wss.clients.forEach((socket) => {
      socket.close();
    });
    // Wait for sockets to close, then hard close any remaining
    await new Promise((resolve) => setTimeout(resolve, 3000));
    this.wss.clients.forEach((socket) => {
      if ([socket.OPEN, socket.CLOSING].includes((socket as any).readyState)) {
        socket.terminate();
      }
    });
    this.wss.removeAllListeners();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve, reject) => {
      this.server.close((err?: Error) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private async webSocketRouterHandler(req: any, respondWith: any) {
    let result = null;
    if (req instanceof Array) {
      result = await Promise.all(req.map((r: JSONRPCRequest) => super.routerHandler(r)));
    } else {
      result = await super.routerHandler(req);
    }
    respondWith(JSON.stringify(result));
  }
}
