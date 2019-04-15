import { Router, IMethodMapping } from "./router";
import { OpenRPC } from "@open-rpc/meta-schema";
import Transports, { TTransportOptions, TTransportClasses, TTransportNames } from "./transports";

interface ITransportConfig {
  type: TTransportNames;
  options: TTransportOptions;
}

export interface IServerOptions {
  openrpcDocument: OpenRPC;
  methodHandlerMapping: IMethodMapping;
  transportConfigs: ITransportConfig[];
  methodMapping: IMethodMapping;
}

export default class Server {
  private routers: Router[] = [];
  private transports: TTransportClasses[] = [];

  constructor(private options: IServerOptions) {
    this.addRouter(options.openrpcDocument, options.methodMapping);
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
    console.log("tea pot");
  }

  public start() {
    console.log("started listening on the following transports:port:");
  }
}
