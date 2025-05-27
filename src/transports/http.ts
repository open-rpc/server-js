import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction, Server as ConnectApp } from "connect";
import http, { ServerOptions } from "http";
import ServerTransport, { JSONRPCRequest } from "./server-transport";

export interface HTTPServerTransportOptions extends ServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  app?: ConnectApp;
}

export default class HTTPServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: http.Server;
  private options: HTTPServerTransportOptions;

  constructor(options: HTTPServerTransportOptions) {
    super();
    const app = options.app || connect();

    const corsOptions = options.cors || HTTPServerTransport.defaultCorsOptions;
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

    app.use(this.httpRouterHandler.bind(this) as HandleFunction);

    this.server = http.createServer(app);
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
    return new Promise((resolve, reject) => {
      this.server.close((err?: Error) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  private async httpRouterHandler(req: any, res: any): Promise<void> {
    // bind req and res as the context for method calls
    const context = { req, res };
    let result = null;
    if (req.body instanceof Array) {
      result = await Promise.all(
        req.body.map((r: JSONRPCRequest) => super.routerHandler(r, context)),
      );
    } else {
      result = await super.routerHandler(req.body, context);
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
