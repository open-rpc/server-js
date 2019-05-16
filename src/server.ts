import { Router, IMethodMapping } from "./router";
import { OpenRPC } from "@open-rpc/meta-schema";
import Transports, { TTransportOptions, TTransportClasses, TTransportNames } from "./transports";

import cors from "cors";
import { json as jsonParser } from "body-parser";
import { HandleFunction } from "connect";
import { IHTTPServerTransportOptions } from "./transports/http";
import { IHTTPSServerTransportOptions } from "./transports/https";
import { IWebSocketServerTransportOptions } from "./transports/websocket";

interface ITransportConfig {
  type: TTransportNames;
  options: TTransportOptions;
}

export interface IMockModeOptions {
  mockMode: boolean;
}

export interface IServerOptions {
  openrpcDocument: OpenRPC;
  transportConfigs: ITransportConfig[];
  methodMapping: IMethodMapping | IMockModeOptions;
}

export default class Server {
  private routers: Router[] = [];
  private transports: TTransportClasses[] = [];

  constructor(private options: IServerOptions) {
    this.addRouter(
      options.openrpcDocument,
      options.methodMapping as IMethodMapping,
    );

    options.transportConfigs.forEach((transportConfig) => {
      this.addTransport(transportConfig.type, transportConfig.options);
    });
  }

  public addTransport(transportType: TTransportNames, transportOptions: TTransportOptions) {
    const TransportClass = Transports[transportType];

    if (TransportClass === undefined) {
      throw new Error(`The transport "${transportType}" is not a valid transport type.`);
    }

    const transport = new TransportClass(transportOptions);

    this.routers.forEach((router) => {
      transport.addRouter(router);
    });

    this.transports.push(transport);
  }

  public addRouter(openrpcDocument: OpenRPC, methodMapping: IMethodMapping) {
    const router = new Router(openrpcDocument, methodMapping);
    this.routers.push(router);
    this.transports.forEach((transport) => transport.addRouter(router));
  }

  public removeRouter() {
    console.log("tea pot"); // tslint:disable-line
  }

  public start() {
    this.transports.forEach((transport) => transport.start());
  }
}
