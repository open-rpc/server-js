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
  public client: any
  // public client: AsyncMQTT.AsyncClient

  constructor(options: MQTTServerTransportOptions) {
    super()
    this.options = { ...options }
    this.client = null
  }

  public async connect(): Promise<any> {
    this.client = await AsyncMQTT.connectAsync(this.options.broker);
  }

  public end(): void {
    this.client.end()
  }
}
