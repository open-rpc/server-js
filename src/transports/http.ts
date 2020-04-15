import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http, { ServerOptions } from "http";
import ServerTransport, { JSONRPCRequest } from "./server-transport";

export interface HTTPServerTransportOptions extends ServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
}

export default class HTTPServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: http.Server;
  private options: HTTPServerTransportOptions;

  constructor(options: HTTPServerTransportOptions) {
    super();
    const app = connect();

    const corsOptions = options.cors || HTTPServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
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

  public start(): void {
    this.server.listen(this.options.port);
  }

  public stop(): void {
    this.server.close();
  }

  private async httpRouterHandler(req: any, res: any): Promise<void> {
    let result = null;
    if (req.body instanceof Array) {
      result = await Promise.all(req.body.map((r: JSONRPCRequest) => super.routerHandler(r)));
    } else {
      result = await super.routerHandler(req.body);
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
