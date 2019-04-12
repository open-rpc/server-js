import _ from "lodash";
import {
  ExamplePairingObject,
  MethodObject,
  ExampleObject,
  ContentDescriptorObject,
  OpenRPC,
} from "@open-rpc/meta-schema";
import { MethodCallValidator } from "@open-rpc/schema-utils-js";
const jsf = require("json-schema-faker"); // tslint:disable-line

export interface IMethodMapping {
  [methodName: string]: (...params: any) => Promise<any>;
}

export interface IMockModeSettings {
  mockMode: boolean;
}

export type TMethodHandler = (...args: any) => Promise<any>;

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

  private methods: IMethodMapping;
  private methodCallValidator: MethodCallValidator;

  constructor(
    private openrpcDocument: OpenRPC,
    methodMapping: IMethodMapping | IMockModeSettings,
  ) {
    if (methodMapping.mockMode) {
      this.methods = this.buildMockMethodMapping(openrpcDocument.methods);
    } else {
      this.methods = methodMapping as IMethodMapping;
    }

    this.methodCallValidator = new MethodCallValidator(this.openrpcDocument);
  }

  public async call(methodName: string, params: any[]) {
    const validationErrors = this.methodCallValidator.validate(methodName, params);
    if (validationErrors.length > 0) {
      return {
        error: {
          code: -32602,
          data: validationErrors,
          message: "Invalid params",
        },
      };
    }
    try {
      return await this.methods[methodName](...params);
    } catch (e) {
      return { code: 6969, message: "unknown error" };
    }
  }

  public isMethodImplemented(methodName: string): boolean {
    return this.methods[methodName] !== undefined;
  }

  private buildMockMethodMapping(methods: MethodObject[]): IMethodMapping {
    return _.chain(methods)
      .keyBy("name")
      .mapValues((methodObject: MethodObject) => async (...args: any): Promise<any> => {
        const foundExample = _.find(
          methodObject.examples as ExamplePairingObject[],
          ({ params }) => _.isMatch(_.map(params, "value"), args),
        );
        if (foundExample) {
          const foundExampleResult = foundExample.result as ExampleObject;
          return Promise.resolve({ result: foundExampleResult.value });
        } else {
          const result = methodObject.result as ContentDescriptorObject;
          return { result: await jsf.generate(result.schema) };
        }
      })
      .value();
  }

}
