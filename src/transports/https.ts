import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
import http2, { ServerOptions, Http2SecureServer, SecureServerOptions } from "http2";
import ServerTransport, { IJSONRPCRequest } from "./server-transport";
import { IncomingMessage } from "http";

export interface IHTTPSServerTransportOptions extends SecureServerOptions {
  middleware: HandleFunction[];
  port: number;
  cors?: cors.CorsOptions;
  allowHTTP1?: boolean;
}

export default class HTTPSServerTransport extends ServerTransport {
  private static defaultCorsOptions = { origin: "*" };
  private server: Http2SecureServer;

  constructor(private options: IHTTPSServerTransportOptions) {
    super();
    options.allowHTTP1 = true;

    const app = connect();

    const corsOptions = options.cors || HTTPSServerTransport.defaultCorsOptions;
    this.options = {
      ...options,
      middleware: [
        cors(corsOptions) as HandleFunction,
        jsonParser(),
        ...options.middleware,
      ],
    };

    this.options.middleware.forEach((mw) => app.use(mw));
    app.use(this.httpsRouterHandler.bind(this));
    this.server = http2.createSecureServer(options, (req: any, res: any) => app(req, res));
  }

  public start() {
    this.server.listen(this.options.port);
  }

  public stop() {
    this.server.close();
  }

  private async httpsRouterHandler(req: any, res: any) {
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
