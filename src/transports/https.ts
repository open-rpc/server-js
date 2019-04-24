import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http2, { ServerOptions, Http2SecureServer, SecureServerOptions } from "http2";
import ServerTransport from "./server-transport";
import { IncomingMessage } from "http";

export type THTTPSServerTransportOptions = {
  middleware: HandleFunction[],
  port: number,
  allowHTTP1?: boolean,
} & SecureServerOptions;

export default class HTTPSServerTransport extends ServerTransport {
  private server: Http2SecureServer;

  constructor(private options: THTTPSServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = connect();
    const corsOptions = { origin: "*" } as cors.CorsOptions;

    app.use(cors(corsOptions) as HandleFunction);
    app.use(jsonParser());
    app.use(this.httpsRouterHandler.bind(this));
    this.server = http2.createSecureServer(options, (req: any, res: any) => app(req, res));
  }

  public start() {
    this.server.listen(this.options.port);
  }

  private async httpsRouterHandler(req: any, res: any) {
    const result = await super.routerHandler(req.body.id, req.body.method, req.body.params);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  }
}
