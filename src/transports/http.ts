import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http, { ServerOptions } from "http";
import ServerTransport, { IJSONRPCRequest } from "./server-transport";

export interface IHTTPServerTransportOptions extends ServerOptions {
  middleware?: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
}

export default class HTTPServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: http.Server;
  private options: IHTTPServerTransportOptions;

  constructor(options: IHTTPServerTransportOptions) {
    super();
    const app = connect();

    const corsOptions = options.cors || HTTPServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser(),
        ...options.middleware,
      ],
    };

    this.options.middleware.forEach((mw) => app.use(mw));

    app.use(this.httpRouterHandler.bind(this) as HandleFunction);

    this.server = http.createServer(app);
  }

  public start() {
    this.server.listen(this.options.port);
  }

  public stop() {
    this.server.close();
  }

  private async httpRouterHandler(req: any, res: any) {
    let result = null;
    if (req.body instanceof Array) {
      result = await Promise.all(req.body.map((r: IJSONRPCRequest) => super.routerHandler(r)));
    } else {
      result = await super.routerHandler(req.body);
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
