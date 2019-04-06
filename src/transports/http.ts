import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http from "http";
import { ServerTransport } from "./server-transport";

interface IHTTPServerTransportOptions {
  port: number;
}

export class HTTPServerTransport extends ServerTransport {
  private server: http.Server;

  constructor(private options: IHTTPServerTransportOptions) {
    super();
    const app = connect();
    const corsOptions = { origin: "*" } as cors.CorsOptions;

    app.use(cors(corsOptions) as HandleFunction);
    app.use(jsonParser());

    app.use(this.httpRouterHandler.bind(this) as HandleFunction);

    this.server = http.createServer(app);
  }

  public start() {
    this.server.listen(this.options.port);
  }

  private async httpRouterHandler(req: any, res: any) {
    const result = await this.routerHandler(req.body.id, req.body.method, req.body.params);
    res.end(JSON.stringify(result));
  }
}
