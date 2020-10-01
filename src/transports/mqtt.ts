import cors from "cors";
import { json as jsonParser } from "body-parser";
import connect, { HandleFunction } from "connect";
// import http, { ServerOptions } from "http";
import AsyncMQTT, { AsyncClient } from "async-mqtt"
import ServerTransport, { JSONRPCRequest } from "./server-transport";

export interface MQTTServerTransportOptions {
  // middleware: HandleFunction[];
  // server: string;
  // port: number;
  broker: string;
  inTopic: string;
  outTopic: string;
}


export default class MQTTServerTransport extends ServerTransport {
  private options: MQTTServerTransportOptions
  public client: AsyncMQTT.AsyncClient | null
  // public client: AsyncMQTT.AsyncClient

  constructor(options: MQTTServerTransportOptions) {
    super()
    this.options = { ...options }
    this.client = null
  }

  public async connect(): Promise<any> {
    this.client = await AsyncMQTT.connectAsync(this.options.broker);
    this.client.subscribe(this.options.inTopic)
    this.client.on('message', (topic: string, payload: Buffer) => {
      this.mqttRouterHandler(JSON.parse(payload.toString()))
    })
  }

  public end(): void {
    this.client?.end()
  }

  private async mqttRouterHandler(payload: any): Promise<void> {
    let result = null;
    if (payload instanceof Array) {
      result = await Promise.all(payload.map((r: JSONRPCRequest) => super.routerHandler(r)));
    } else {
      result = await super.routerHandler(payload);
    }
    this.client?.publish(this.options.outTopic, JSON.stringify(result))
  }
}
