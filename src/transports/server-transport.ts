import { Router } from "../router";

export interface JSONRPCRequest {
  jsonrpc: string;
  id?: string;
  method: string;
  params: any[] | Record<string, unknown>;
}

export interface JSONRPCErrorObject {
  code: number;
  message: string;
  data: any;
}

export interface JSONRPCResponse {
  jsonrpc: string;
  id?: string;
  result?: any;
  error?: JSONRPCErrorObject;
}

export abstract class ServerTransport {
  public routers: Router[] = [];

  public addRouter(router: Router): void {
    this.routers.push(router);
  }

  public removeRouter(router: Router): void {
    this.routers = this.routers.filter((r) => r !== router);
  }

  public async start(): Promise<void> {
    console.warn("Transport must implement start()"); // tslint:disable-line
    throw new Error("Transport missing start implementation");
  }

  public async stop(): Promise<void> {
    console.warn("Transport must implement stop()"); // tslint:disable-line
    throw new Error("Transport missing stop implementation");
  }

  protected async routerHandler(request: JSONRPCRequest, context?: any): Promise<JSONRPCResponse> {
    const { id, method, params } = request;
    if (this.routers.length === 0) {
      console.warn("transport method called without a router configured."); // tslint:disable-line
      throw new Error("No router configured");
    }

    const routerForMethod = this.routers.find((r) => r.isMethodImplemented(method));

    let res = {
      id,
      jsonrpc: "2.0",
    };

    if (routerForMethod === undefined) {
      // method not found in any of the routers.
      res = {
        ...res,
        ...Router.methodNotFoundHandler(method)
      };
    } else {
      // forward context when invoking the method
      res = {
        ...res,
        ...await (routerForMethod as any).call(method, params, context)
      };
    }

    return res;
  }
}
export default ServerTransport;