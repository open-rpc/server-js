import { Router, IMethodMapping } from "./router";
import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";
import Transports, { TTransportOptions, TTransportClasses, TTransportNames } from "./transports";

import cors from "cors";
import { json as jsonParser } from "body-parser";
import { HandleFunction } from "connect";
import { IHTTPServerTransportOptions } from "./transports/http";
import { IHTTPSServerTransportOptions } from "./transports/https";
import { IWebSocketServerTransportOptions } from "./transports/websocket";
import _ from "lodash";

interface ITransportConfig {
  type: TTransportNames;
  options: TTransportOptions;
}

export interface IMockModeOptions {
  mockMode: boolean;
}

export interface IServerOptions {
  openrpcDocument: OpenRPC;
  transportConfigs?: ITransportConfig[];
  methodMapping?: IMethodMapping | IMockModeOptions;
}

export default class Server {
  private routers: Router[] = [];
  private transports: TTransportClasses[] = [];

  constructor(private options: IServerOptions) {
    if (options.methodMapping) {
      this.addRouter(
        options.openrpcDocument,
        options.methodMapping,
      );
    }

    if (options.transportConfigs) {
      options.transportConfigs.forEach((transportConfig) => {
        this.addTransport(transportConfig.type, transportConfig.options);
      });
    }
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

  public addRouter(openrpcDocument: OpenRPC, methodMapping: IMethodMapping | IMockModeOptions) {
    const router = new Router(openrpcDocument, methodMapping);

    this.routers.push(router);
    this.transports.forEach((transport) => transport.addRouter(router));

    return router;
  }

  public removeRouter(routerToRemove: Router) {
    this.routers = _.without(this.routers, routerToRemove);
    this.transports.forEach((transport) => transport.removeRouter(routerToRemove));
  }

  public start() {
    this.transports.forEach((transport) => transport.start());
  }
}
