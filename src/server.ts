import { Router } from "./router";
import { OpenRPC } from "@open-rpc/meta-schema";
import { IWebSocketServerTransportOptions } from "./transports/websocket";
import { IHTTPServerTransportOptions } from "./transports/http";
import { IHTTPSServerTransportOptions } from "./transports/https";
import { IIpcServerTransportOptions } from "./transports/ipc";

export interface IMethodHandlerMapping {
  [key: string]: (...params: any) => Promise<any>;
}

export enum TTransports {
  IPCTransport = "IPCTransport",
  HTTPTransport = "HTTPTransport",
  HTTPSTransport = "HTTPSTransport",
  WebSocketServerTransport = "WebSocketServerTransport",
}

export type TTransportOptions =
  IWebSocketServerTransportOptions |
  IHTTPServerTransportOptions |
  IHTTPSServerTransportOptions |
  IIpcServerTransportOptions;

interface ITransportConfig {
  type: string;
  options: TTransportOptions;
}

export interface IServerOptions {
  openrpcDocument: OpenRPC;
  methodHandlerMapping: IMethodHandlerMapping;
  transportConfigs: ITransportConfig[];
}

export default class Server {
  constructor(private options: IServerOptions) {
    console.log("teapot");
  }

  public start() {
    console.log("started listening on the following transports:port:");
  }
}
