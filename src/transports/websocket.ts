import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction, Server as ConnectApp } from "connect";
import http2, { Http2SecureServer, SecureServerOptions } from "http2";
import http from "http";
import ServerTransport, { JSONRPCRequest, JSONRPCResponse } from "./server-transport";
import WebSocket from "ws";

export interface ClientMethods {
  [methodName: string]: (...params: any[]) => Promise<any>;
}

export interface ConnectedClient {
  id: string;
  methods: ClientMethods;
}

interface PendingClientRequest {
  socket: WebSocket;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface WebSocketServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
  app?: ConnectApp;
  timeout?: number;
  outboundHandler?: (clients: ConnectedClient[]) => Promise<void> | void;
  outboundIntervalMs?: number;
}

export default class WebSocketServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer | http.Server;
  private wss: WebSocket.Server;
  private pendingClientRequests = new Map<string, PendingClientRequest>();
  private clientDetails = new Map<WebSocket, ConnectedClient>();
  private outboundInterval?: NodeJS.Timeout;
  private nextClientId = 0;
  private nextRequestId = 0;

  constructor(private options: WebSocketServerTransportOptions) {
    super();
    // Ensure a default timeout if none provided
    options.timeout = options.timeout ?? 3000;
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
      const client = {
        id: `client-${this.nextClientId++}`,
        methods: this.buildClientMethodsProxy(ws),
      };
      this.clientDetails.set(ws, client);

      ws.on("message", (message: WebSocket.Data) => {
        void this.handleWebSocketMessage(message, ws);
      });
      ws.on("close", () => this.handleClientClose(ws));
    });
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.options.port, (err?: Error) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (this.options.outboundHandler) {
      const intervalMs = this.options.outboundIntervalMs ?? 1000;
      this.outboundInterval = setInterval(() => {
        void Promise.resolve(this.options.outboundHandler!(Array.from(this.clientDetails.values())))
          .catch(() => undefined);
      }, intervalMs);
    }
  }

  public async stop(): Promise<void> {
    if (this.outboundInterval) {
      clearInterval(this.outboundInterval);
      this.outboundInterval = undefined;
    }

    this.pendingClientRequests.forEach(({ reject }) => {
      reject(new Error("WebSocket connection closed"));
    });
    this.pendingClientRequests.clear();

    // First sweep, soft close
    this.wss.clients.forEach((socket) => {
      socket.close();
    });
    // Wait for sockets to close, then hard close any remaining
    await new Promise((resolve) => setTimeout(resolve, this.options.timeout));
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

  private handleClientClose(ws: WebSocket) {
    ws.removeAllListeners();
    this.clientDetails.delete(ws);
    this.pendingClientRequests.forEach((pendingRequest, requestId) => {
      if (pendingRequest.socket === ws) {
        pendingRequest.reject(new Error("WebSocket connection closed"));
        this.pendingClientRequests.delete(requestId);
      }
    });
  }

  private buildClientMethodsProxy(ws: WebSocket): ClientMethods {
    const methodNames = Array.from(new Set(this.routers.flatMap((router) => router.getMethodsImplementedBy("client"))));

    return methodNames.reduce((methods: ClientMethods, methodName: string) => {
      methods[methodName] = (...params: any[]) => this.callClientMethod(ws, methodName, params);
      return methods;
    }, {});
  }

  private callClientMethod(ws: WebSocket, method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `server-${this.nextRequestId++}`;
      this.pendingClientRequests.set(id, { socket: ws, resolve, reject });
      ws.send(JSON.stringify({ id, jsonrpc: "2.0", method, params }), (err) => {
        if (err) {
          this.pendingClientRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  private async handleWebSocketMessage(message: WebSocket.Data, ws: WebSocket) {
    const messageAsString = typeof message === "string" ? message : message.toString();
    const payload = JSON.parse(messageAsString);

    if (payload instanceof Array) {
      const batchResponses = await Promise.all(payload.map((reqOrRes: any) => this.routePayload(reqOrRes, ws)));
      const filteredResponses = batchResponses.filter((response) => response !== null);
      if (filteredResponses.length > 0) {
        ws.send(JSON.stringify(filteredResponses));
      }
      return;
    }

    const response = await this.routePayload(payload, ws);
    if (response) {
      ws.send(JSON.stringify(response));
    }
  }

  private async routePayload(payload: any, ws: WebSocket): Promise<JSONRPCResponse | null> {
    if (this.isResponsePayload(payload)) {
      this.resolvePendingClientRequest(payload);
      return null;
    }

    return super.routerHandler(payload as JSONRPCRequest, { client: this.clientDetails.get(ws)?.methods });
  }

  private resolvePendingClientRequest(payload: JSONRPCResponse) {
    if (!payload.id) {
      return;
    }

    const pendingRequest = this.pendingClientRequests.get(payload.id);
    if (!pendingRequest) {
      return;
    }
    this.pendingClientRequests.delete(payload.id);

    if (payload.error) {
      pendingRequest.reject(new Error(payload.error.message));
      return;
    }

    pendingRequest.resolve(payload.result);
  }

  private isResponsePayload(payload: JSONRPCRequest | JSONRPCResponse): payload is JSONRPCResponse {
    return (payload as JSONRPCResponse).result !== undefined
      || (payload as JSONRPCResponse).error !== undefined;
  }
}
