import { Router } from "../router";
import _ from "lodash";

export default abstract class ServerTransport {
  public routers: Router[] = [];

  public addRouter(router: Router) {
    this.routers.push(router);
  }

  public removeRouter(router: Router) {
    this.routers = _.without(this.routers, router);
  }

  protected async routerHandler(id: string | number, methodName: string, params: any[]) {
    if (this.routers.length === 0) {
      console.warn("transport method called without a router configured.");
      return Router.methodNotFoundHandler(methodName);
    }

    const routerForMethod = _.find(
      this.routers,
      (router: Router) => router.isMethodImplemented(methodName),
    );

    if (routerForMethod === undefined) {
      // method not found in any of the routers.
      return Router.methodNotFoundHandler(methodName);
    }

    const result = await routerForMethod.call(methodName, params);

    return {
      id,
      jsonrpc: "2.0",
      result,
    };
  }
}
