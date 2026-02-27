import {
  ExamplePairingObject,
  MethodObject,
  ExampleObject,
  ContentDescriptorObject,
  OpenrpcDocument,
} from "@open-rpc/meta-schema";
import { MethodCallValidator, MethodNotFoundError, ParameterValidationError } from "@open-rpc/schema-utils-js";
import _ from "lodash";
import { JSONRPCError } from "./error";

const jsf = require("json-schema-faker"); // eslint-disable-line

export interface MethodMapping {
  [methodName: string]: (...params: any) => Promise<any>;
}

export interface MockModeSettings {
  mockMode: boolean;
}

export type TMethodHandler = (...args: any) => Promise<any>;
export interface RouterCallContext {
  client?: unknown;
  [key: string]: unknown;
}

export interface RouterPluginMethodImplementationContext {
  methodName: string;
  methodObject?: MethodObject;
  hasLocalHandler: boolean;
  openrpcDocument: OpenrpcDocument;
  context?: RouterCallContext;
}

export interface RouterPluginInvocationContext extends RouterPluginMethodImplementationContext {
  params: any;
  paramsAsArray: any[];
}

export interface RouterPluginListMethodsContext {
  methods: MethodObject[];
  openrpcDocument: OpenrpcDocument;
  context?: RouterCallContext;
}

export interface RouterPlugin {
  name: string;
  isMethodImplemented?: (context: RouterPluginMethodImplementationContext) => boolean | undefined;
  mapHandlerParams?: (context: RouterPluginInvocationContext) => any[] | undefined;
  listMethods?: (context: RouterPluginListMethodsContext) => string[] | undefined;
}

export interface RouterOptions {
  plugins?: RouterPlugin[];
}

const toArray = (method?: MethodObject, params?: Record<string, unknown>) => {
  if (!method) {
    return [];
  }
  if (!params) {
    return [];
  }
  const docParams = method.params as ContentDescriptorObject[];
  const methodParamsOrder: { [k: string]: number } = docParams
    .map((p) => p.name)
    .reduce((m, pn, i) => ({ ...m, [pn]: i }), {});

  return Object.entries(params)
    .reduce((params: unknown[], [key, val]) => {
      params[methodParamsOrder[key]] = val;
      return params;
    }, []);
};

export class Router {

  public static methodNotFoundHandler(methodName: string) {
    return {
      error: {
        code: -32601,
        data: `The method ${methodName} does not exist / is not available.`,
        message: "Method not found",
      },
    };
  }
  private methods: MethodMapping;
  private methodCallValidator: MethodCallValidator;
  private plugins: RouterPlugin[];

  private getMethodObject(methodName: string): MethodObject | undefined {
    return (this.openrpcDocument.methods as MethodObject[]).find((m) => m.name === methodName);
  }

  private getImplementedBy(methodName: string): string[] {
    const methodObject = this.getMethodObject(methodName);
    if (!methodObject) {
      return [];
    }

    const implementedBy = (methodObject as MethodObject & { [key: string]: unknown })["x-implemented-by"];
    if (implementedBy === undefined) {
      return ["server"];
    }

    if (implementedBy instanceof Array) {
      return implementedBy.filter((role): role is string => typeof role === "string");
    }

    return [];
  }

  constructor(
    private openrpcDocument: OpenrpcDocument,
    methodMapping: MethodMapping | MockModeSettings,
    options: RouterOptions = {},
  ) {
    if (methodMapping.mockMode) {
      this.methods = this.buildMockMethodMapping(openrpcDocument.methods as MethodObject[]);
    } else {
      this.methods = methodMapping as MethodMapping;
    }
    this.methods["rpc.discover"] = this.serviceDiscoveryHandler.bind(this);

    this.methodCallValidator = new MethodCallValidator(openrpcDocument);
    this.plugins = options.plugins || [];
  }

  public async call(methodName: string, params: any, context?: RouterCallContext) {
    if (!this.isMethodImplemented(methodName, context)) {
      return Router.methodNotFoundHandler(methodName);
    }

    const validationErrors = this.methodCallValidator.validate(methodName, params);

    if (validationErrors instanceof MethodNotFoundError) {
      return Router.methodNotFoundHandler(methodName);
    }

    if (validationErrors.length > 0) {
      return this.invalidParamsHandler(validationErrors);
    }

    const methodObject = this.getMethodObject(methodName) as MethodObject;

    let paramsAsArray = params instanceof Array ? params : toArray(methodObject, params);

    try {
      let paramsMappedByPlugin = false;
      for (const plugin of this.plugins) {
        if (!plugin.mapHandlerParams) {
          continue;
        }

        const mappedParams = plugin.mapHandlerParams({
          context,
          hasLocalHandler: this.methods[methodName] !== undefined,
          methodName,
          methodObject,
          openrpcDocument: this.openrpcDocument,
          params,
          paramsAsArray,
        });

        if (mappedParams !== undefined) {
          paramsAsArray = mappedParams;
          paramsMappedByPlugin = true;
        }
      }

      if (!paramsMappedByPlugin && context && context.client !== undefined) {
        paramsAsArray = [...paramsAsArray, context.client];
      }

      return { result: await this.methods[methodName](...paramsAsArray) };
    } catch (e) {
      if (e instanceof JSONRPCError) {
        return { error: { code: e.code, message: e.message, data: e.data } };
      }
      return { error: { code: 6969, message: "unknown error" } };
    }
  }

  public isMethodImplemented(methodName: string, context?: RouterCallContext): boolean {
    const methodObject = (this.openrpcDocument.methods as MethodObject[]).find((m) => m.name === methodName);
    const hasLocalHandler = this.methods[methodName] !== undefined;

    if (!hasLocalHandler) {
      return false;
    }

    if (methodName === "rpc.discover") {
      return true;
    }

    for (const plugin of this.plugins) {
      if (!plugin.isMethodImplemented) {
        continue;
      }
      const pluginResult = plugin.isMethodImplemented({
        context,
        hasLocalHandler,
        methodName,
        methodObject,
        openrpcDocument: this.openrpcDocument,
      });
      if (pluginResult === false) {
        return false;
      }
    }

    return this.getImplementedBy(methodName).includes("server");
  }

  public getMethodsImplementedBy(participant: string): string[] {
    return (this.openrpcDocument.methods as MethodObject[])
      .filter((method) => this.getImplementedBy(method.name).includes(participant))
      .map((method) => method.name)
      .filter((methodName) => methodName !== "rpc.discover");
  }

  public getAvailableMethods(context?: RouterCallContext): string[] {
    const methods = this.openrpcDocument.methods as MethodObject[];

    for (const plugin of this.plugins) {
      if (!plugin.listMethods) {
        continue;
      }
      const methodList = plugin.listMethods({
        context,
        methods,
        openrpcDocument: this.openrpcDocument,
      });

      if (methodList !== undefined) {
        return methodList.filter((methodName) => methodName !== "rpc.discover");
      }
    }

    return methods
      .map((method) => method.name)
      .filter((methodName) => methodName !== "rpc.discover")
      .filter((methodName) => this.isMethodImplemented(methodName, context));
  }

  private serviceDiscoveryHandler(): Promise<OpenrpcDocument> {
    return Promise.resolve(this.openrpcDocument);
  }

  private buildMockMethodMapping(methods: MethodObject[]): MethodMapping {
    const methMap: MethodMapping = {};

    methods.forEach((method) => {
      methMap[method.name] = (...args: any): Promise<any> => {
        if (method.examples === undefined) {
          const result = method.result as ContentDescriptorObject;
          return Promise.resolve(jsf.generate(result.schema));
        }

        const foundExample = (method.examples as ExamplePairingObject[]).find(({ params }) => {
          let isMatch = true;
          (params as ExampleObject[]).forEach((p, i) => {
            const eq = _.isEqual(p.value, args[i]);
            if (!eq) { isMatch = false; }
          });
          return isMatch;
        });

        if (foundExample) {
          const foundExampleResult = foundExample.result as ExampleObject;
          return Promise.resolve(foundExampleResult.value);
        } else {
          const result = method.result as ContentDescriptorObject;
          return Promise.resolve(jsf.generate(result.schema));
        }
      };
    });

    return methMap;
  }

  private invalidParamsHandler(errs: ParameterValidationError[]) {
    return {
      error: {
        code: -32602,
        data: errs,
        message: "Invalid params",
      },
    };
  }
}
