import { Router } from "../router";
import _ from "lodash";

export interface IJSONRPCRequest {
  jsonrpc: string;
  id?: string;
  method: string;
  params: any[] | {};
}

export interface IJSONRPCErrorObject {
  code: number;
  message: string;
  data: any;
}

export interface IJSONRPCResponse {
  jsonrpc: string;
  id?: string;
  result?: any;
  error?: IJSONRPCErrorObject;
}

export default abstract class ServerTransport {
  public routers: Router[] = [];

  public addRouter(router: Router) {
    this.routers.push(router);
  }

  public removeRouter(router: Router) {
    this.routers = _.without(this.routers, router);
  }

  protected async routerHandler({ id, method, params }: IJSONRPCRequest) {
    if (this.routers.length === 0) {
      console.warn("transport method called without a router configured."); // tslint:disable-line
      return new Error("No router configured");
    }

    const routerForMethod = _.find(
      this.routers,
      (router: Router) => router.isMethodImplemented(method),
    );

    if (routerForMethod === undefined) {
      // method not found in any of the routers.
      return Router.methodNotFoundHandler(method);
    }
    // cast params to any[] until https://github.com/open-rpc/schema-utils-js/issues/206 is fixed
    const result = await routerForMethod.call(method, params as any[]);

    return {
      id,
      jsonrpc: "2.0",
      result,
    };
  }
}
