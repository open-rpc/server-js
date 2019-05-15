import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http, { ServerOptions } from "http";
import ServerTransport from "./server-transport";

export interface IHTTPServerTransportOptions extends ServerOptions {
  middleware: HandleFunction[];
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

  private async httpRouterHandler(req: any, res: any) {
    const result = await this.routerHandler(req.body.id, req.body.method, req.body.params);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
