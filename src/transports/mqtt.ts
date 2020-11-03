import ServerTransport, { JSONRPCRequest } from "./server-transport";
import Aedes from "aedes";
import tls from "tls";
import net from "net";

export interface MQTTServerTransportOptions {
  inTopic: string;
  outTopic: string;
  host: string;
  protocol: "tcp";
  port: number | string;
  /*
   * Use filename of cert / key file.
   */
  tls?: {
    key: string;
    cert: string;
  };
}

export default class MQTTServerTransport extends ServerTransport {
  private options: MQTTServerTransportOptions;
  private aedes: any;
  public server: any;

  constructor(options: MQTTServerTransportOptions) {
    super();
    this.options = { ...options };

    this.aedes = Aedes();

    switch (this.options.protocol) {
      case "tcp":
        this.server = net.createServer(this.aedes.handle);
        break;
    }

    this.aedes.on("publish", (packet: any, client: any) => {
      if (packet.topic !== "inTopic") { return; }

      const { payload } = packet;
      const parsed = payload.toString();
      let jsonrpcRequest;

      try {
        jsonrpcRequest = JSON.parse(parsed);
      } catch (e) {
        throw e;
      }

      this.mqttRouterHandler(jsonrpcRequest, (v: string) => {
        client.publish({
          topic: "outTopic",
          payload: Buffer.from(v),
        }, (e: Error) => {
          if (e) { throw e; }
        });
      });
    });
  }

  public async start(): Promise<void> {
    this.server.listen(this.options.port);
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.aedes.close(() => {
        this.server.close();
        resolve();
      });
    });
  }

  private publishMessageHandler(packet: any, client: any) {
    if (packet.topic !== "inTopic") { return; }

    const { payload } = packet;
    const parsed = payload.toString();
    let jsonrpcRequest;

    try {
      jsonrpcRequest = JSON.parse(parsed);
    } catch (e) {
      throw e;
    }

    this.mqttRouterHandler(jsonrpcRequest, (v: string) => {
      client.publish({
        topic: "outTopic",
        payload: Buffer.from(v),
      }, (e: Error) => {
        if (e) { throw e; }
      });
    });
  }

  private async mqttRouterHandler(payload: any, respondWith: any): Promise<void> {
    let result = null;
    if (payload instanceof Array) {
      result = await Promise.all(payload.map((r: JSONRPCRequest) => super.routerHandler(r)));
    } else {
      result = await super.routerHandler(payload);
    }
    return respondWith(JSON.stringify(result));
  }
}
