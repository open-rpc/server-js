import { Router, MethodMapping } from "./router";
import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";
import Transports, {ServerTransport, TransportOptions, TransportClasses, TransportNames } from "./transports";

interface TransportConfig {
  type: TransportNames;
  options: TransportOptions;
}

export interface MockModeOptions {
  mockMode: boolean;
}

export interface ServerOptions {
  openrpcDocument: OpenRPC;
  transportConfigs?: TransportConfig[];
  methodMapping?: MethodMapping | MockModeOptions;
}

export default class Server {
  private routers: Router[] = [];
  private transports: TransportClasses[] = [];

  constructor(options: ServerOptions) {
    if (options.methodMapping) {
      this.addRouter(
        options.openrpcDocument,
        options.methodMapping,
      );
    }

    if (options.transportConfigs) {
      options.transportConfigs.forEach((transportConfig) => {
        this.addDefaultTransport(transportConfig.type, transportConfig.options);
      });
    }
  }

  public addTransport(transport: ServerTransport): void{
    this.routers.forEach((router) => {
      transport.addRouter(router);
    });

    this.transports.push(transport);
  }

  public addDefaultTransport(transportType: TransportNames, transportOptions: TransportOptions) {
    const TransportClass = Transports[transportType];

    console.log(`Adding Transport of the type ${transportType} on port ${transportOptions.port}`);

    if (TransportClass === undefined) {
      throw new Error(`The transport "${transportType}" is not a valid transport type.`);
    }

    const transport = new TransportClass(transportOptions);
    this.addTransport(transport);
  }

  public addRouter(openrpcDocument: OpenRPC, methodMapping: MethodMapping | MockModeOptions) {
    const router = new Router(openrpcDocument, methodMapping);

    this.routers.push(router);
    this.transports.forEach((transport) => transport.addRouter(router));

    return router;
  }

  public removeRouter(routerToRemove: Router) {
    this.routers = this.routers.filter((r) => r !== routerToRemove);
    this.transports.forEach((transport) => transport.removeRouter(routerToRemove));
  }

  public start() {
    this.transports.forEach((transport) => transport.start());
  }

  public quit() {
    this.transports.forEach((transport) => transport.stop());
  }
}
