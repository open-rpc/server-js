import ServerTransport, { JSONRPCRequest } from "./server-transport";
import ipc from "node-ipc";

export interface IPCServerTransportOptions {
  id: string;
  port: number;
  udp: boolean;
  ipv6: boolean;
}

type UdpType = "udp4" | "udp6" | undefined;

export default class IPCServerTransport extends ServerTransport {
  private server: any;

  constructor(private options: IPCServerTransportOptions) {
    super();

    const udpOption = (options.udp) ? `udp${(options.ipv6) ? "6" : "4"}` : undefined;
    ipc.config.id = options.id;
    ipc.config.logger = () => {
      // noop
    };

    ipc.serveNet(
      undefined,
      options.port as number,
      udpOption as UdpType,
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

  public async start(): Promise<void> {
    this.server.start(this.options.port);
    // node-ipc is sync, but yield to event loop to ensure server is ready
    await new Promise((resolve) => setImmediate(resolve));
  }

  public async stop(): Promise<void> {
    this.server.stop();
    // node-ipc is sync, but yield to event loop to ensure server is stopped
    await new Promise((resolve) => setImmediate(resolve));
  }

  private async ipcRouterHandler(req: any, respondWith: any) {
    if (req instanceof Array) {
      const result = (await Promise.all(req.map((jsonrpcReq: JSONRPCRequest) => super.routerHandler(jsonrpcReq))))
        .filter((r) => r !== undefined);

      if (result.length === 0) {
        return;
      }

      respondWith(JSON.stringify(result));
      return;
    }

    const result = await super.routerHandler(req);
    if (result === undefined) {
      return;
    }

    respondWith(JSON.stringify(result));
  }
}
