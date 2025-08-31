import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction, Server as ConnectApp } from "connect";
import http2, { Http2SecureServer, SecureServerOptions } from "http2";
import ServerTransport, { JSONRPCRequest } from "./server-transport";

export interface HTTPSServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
  app?: ConnectApp;
}

export default class HTTPSServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer;

  constructor(private options: HTTPSServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = options.app || connect();

    const corsOptions = options.cors || HTTPSServerTransport.defaultCorsOptions;
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
    app.use(this.httpsRouterHandler.bind(this));
    this.server = http2.createSecureServer(options, (req: any, res: any) => app(req, res));
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
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private async httpsRouterHandler(req: any, res: any): Promise<void> {
    if (req.body instanceof Array) {
      const result = (await Promise.all(req.body.map((r: JSONRPCRequest) => super.routerHandler(r))))
        .filter((r) => r !== undefined);

      if (result.length === 0) {
        res.statusCode = 204;
        res.end();
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return;
    }

    const result = await super.routerHandler(req.body);
    if (result === undefined) {
      res.statusCode = 204;
      res.end();
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
