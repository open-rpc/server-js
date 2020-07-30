import ServerTransport, { JSONRPCRequest } from "./server-transport";
import * as ipc from "node-ipc";

export interface IPCServerTransportOptions { // eslint-disable-line @typescript-eslint/interface-name-prefix
  id: string;
  port: number;
  udp: boolean;
  ipv6: boolean;
}

type UdpType = "udp4" | "udp6" | undefined;

const noop = () => { return; }

export default class IPCServerTransport extends ServerTransport {
  private server: any;

  constructor(private options: IPCServerTransportOptions) {
    super();

    const udpOption = (options.udp) ? `udp${(options.ipv6) ? "6" : "4"}` : undefined;
    ipc.config.id = options.id;
    ipc.config.logger = () => { noop(); };

    console.log(ipc.serveNet);
    ipc.serveNet(
      undefined,
      options.port as number | undefined,
      udpOption as UdpType | undefined,
      () => {
        ipc.server.on("message", (data, socket) => {
          const req = JSON.parse(data);

          this.ipcRouterHandler(req, (result: string) => {
            ipc.server.emit(
              socket,
              "message",
              result,
            );
          });
        });
      },
    );

    this.server = ipc.server;
  }

  public async start() {
    this.server.start(this.options.port);
  }

  public stop() {
    this.server.stop();
  }

  private async ipcRouterHandler(req: any, respondWith: any) {
    let result = null;
    if (req instanceof Array) {
      result = await Promise.all(req.map((jsonrpcReq: JSONRPCRequest) => super.routerHandler(jsonrpcReq)));
    } else {
      result = await super.routerHandler(req);
    }
    respondWith(JSON.stringify(result));
  }
}
