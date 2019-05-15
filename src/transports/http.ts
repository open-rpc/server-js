import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http, { ServerOptions } from "http";
import ServerTransport from "./server-transport";

export type THTTPServerTransportOptions = {
  middleware: HandleFunction[],
  port: number;
} & ServerOptions;

export default class HTTPServerTransport extends ServerTransport {
  private server: http.Server;

  constructor(private options: THTTPServerTransportOptions) {
    super();
    const app = connect();

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
