import _ from "lodash";
import {
  ExamplePairingObject,
  MethodObject,
  ExampleObject,
  ContentDescriptorObject,
  OpenrpcDocument,
} from "@open-rpc/meta-schema";
import { MethodCallValidator, MethodNotFoundError, ParameterValidationError } from "@open-rpc/schema-utils-js";
import { JSONRPCError } from "./error";

const jsf = require("json-schema-faker"); // eslint-disable-line @typescript-eslint/interface-name-prefix

export interface MethodMapping {
  [methodName: string]: (...params: any) => Promise<any>;
}

export interface MockModeSettings {
  mockMode: boolean;
}

export type TMethodHandler = (...args: any) => Promise<any>;

const sortParamKeys = (method: MethodObject, params: object) => {
  const docParams = method.params as ContentDescriptorObject[];
  const methodParamsOrder: { [k: string]: number } = docParams
    .map((p) => p.name)
    .reduce((m, pn, i) => ({ ...m, [pn]: i }), {});

  return Object.entries(params).sort((v1, v2) => methodParamsOrder[v1[0]] - methodParamsOrder[v2[0]]);
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
      this.methods = this.buildMockMethodMapping(openrpcDocument.methods);
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

    const methodObject = this.openrpcDocument.methods.find((m) => m.name === methodName) as MethodObject;

    const paramsAsArray = params instanceof Array ? params : sortParamKeys(methodObject, params);

    try {
      return { result: await this.methods[methodName](...paramsAsArray) };
    } catch (e) {
      if (e instanceof JSONRPCError) {
        return { error: { code: e.code, message: e.message, data: e.data } };
      }
      return { error: { code: 6969, message: "unknown error" } };
    }
  }

  public isMethodImplemented(methodName: string): boolean {
    return this.methods[methodName] !== undefined;
  }

  private serviceDiscoveryHandler(): Promise<OpenrpcDocument> {
    return Promise.resolve(this.openrpcDocument);
  }

  private buildMockMethodMapping(methods: MethodObject[]): MethodMapping {
    return _.chain(methods)
      .keyBy("name")
      .mapValues((methodObject: MethodObject) => async (...args: any): Promise<any> => {
        const foundExample = _.find(
          methodObject.examples as ExamplePairingObject[],
          ({ params }) => _.isMatch(_.map(params, "value"), args),
        );
        if (foundExample) {
          const foundExampleResult = foundExample.result as ExampleObject;
          return Promise.resolve(foundExampleResult.value);
        } else {
          const result = methodObject.result as ContentDescriptorObject;
          return jsf.generate(result.schema);
        }
      })
      .value();
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
