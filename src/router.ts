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

  constructor(
    private openrpcDocument: OpenrpcDocument,
    methodMapping: MethodMapping | MockModeSettings,
  ) {
    if (methodMapping.mockMode) {
      this.methods = this.buildMockMethodMapping(openrpcDocument.methods as MethodObject[]);
    } else {
      this.methods = methodMapping as MethodMapping;
    }
    this.methods["rpc.discover"] = this.serviceDiscoveryHandler.bind(this);

    this.methodCallValidator = new MethodCallValidator(openrpcDocument);
  }

  public async call(methodName: string, params: any) {
    const validationErrors = this.methodCallValidator.validate(methodName, params);

    if (validationErrors instanceof MethodNotFoundError) {
      return Router.methodNotFoundHandler(methodName);
    }

    if (validationErrors.length > 0) {
      return this.invalidParamsHandler(validationErrors);
    }

    if (!this.isMethodImplemented(methodName)) {
      return Router.methodNotFoundHandler(methodName);
    }

    const methodObject = (this.openrpcDocument.methods as MethodObject[]).find((m) => m.name === methodName) as MethodObject;

    const paramsAsArray = params instanceof Array ? params : toArray(methodObject, params);

    try {
      return { result: await this.methods[methodName](...paramsAsArray) };
    } catch (e) {
      if (e instanceof JSONRPCError) {
        return { error: { code: e.code, message: e.message, data: e.data } };
      }
      const message = e instanceof Error ? e.message : String(e);
      return { error: { code: -32603, message: "Internal error", data: message } };
    }
  }

  public isMethodImplemented(methodName: string): boolean {
    return this.methods[methodName] !== undefined;
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
