import { Router, IMethodMapping } from "./router";
import examples from "@open-rpc/examples";
import _ from "lodash";
import { parseOpenRPCDocument, MethodNotFoundError } from "@open-rpc/schema-utils-js";
import {
  OpenRPC,
  ContentDescriptorObject,
  ExampleObject,
  ExamplePairingObject,
  MethodObject,
} from "@open-rpc/meta-schema";
const jsf = require("json-schema-faker"); // tslint:disable-line

const makeMethodMapping = (methods: MethodObject[]): IMethodMapping => {
  return _.chain(methods)
    .keyBy("name")
    .mapValues((methodObject: MethodObject) => async (...args: any): Promise<any> => {
      const foundExample = _.find(
        methodObject.examples as ExamplePairingObject[],
        ({ params }: ExamplePairingObject) => _.isMatch(_.map(params, "value"), args),
      );
      if (foundExample) {
        const foundExampleResult = foundExample.result as ExampleObject;
        return foundExampleResult.value;
      } else {
        const result = methodObject.result as ContentDescriptorObject;
        return jsf.generate(result.schema);
      }
    })
    .value();
};

describe("router", () => {
  _.forEach(examples, (example: OpenRPC, exampleName: string) => {
    describe(exampleName, () => {

      let parsedExample: OpenRPC;
      beforeAll(async () => {
        parsedExample = await parseOpenRPCDocument(JSON.stringify(example));
      });

      it("is constructed with an OpenRPC document and a method mapping", () => {
        const methodMapping = makeMethodMapping(parsedExample.methods);

        expect(new Router(parsedExample, methodMapping)).toBeInstanceOf(Router);
      });

      it("it may be constructed in mock mode", () => {
        expect(new Router(parsedExample, { mockMode: true })).toBeInstanceOf(Router);
      });

      if (exampleName === "simpleMath") {
        it("Simple math call works", async () => {
          const router = new Router(parsedExample, makeMethodMapping(parsedExample.methods));
          const result = await router.call("addition", [2, 2]);
          expect(result).toBe(4);
        });

        it("returns not found error when using incorrect method", async () => {
          const router = new Router(parsedExample, makeMethodMapping(parsedExample.methods));
          const result = await router.call("foobar", [2, 2]);
          expect(result.error.code).toBe(-32601);
        });

        it("returns param validation error when passing incorrect params", async () => {
          const router = new Router(parsedExample, makeMethodMapping(parsedExample.methods));
          const result = await router.call("addition", ["123", "321"]);
          expect(result.error.code).toBe(-32602);
        });

        it("implements service discovery", async () => {
          const router = new Router(parsedExample, makeMethodMapping(parsedExample.methods));
          const result = await router.call("rpc.discover", []);
          expect(result).toEqual(parsedExample);
        });

        it("Simple math call validates params", async () => {
          const router = new Router(parsedExample, makeMethodMapping(parsedExample.methods));
          expect(await router.call("addition", ["2", 2])).toEqual({
            error: {
              code: -32602,
              data: expect.any(Array),
              message: "Invalid params",
            },
          });
        });

        it("works in mock mode with valid examplePairing params", async () => {
          const router = new Router(parsedExample, { mockMode: true });
          const result = await router.call("addition", [2, 2]);
          expect(result).toBe(4);
        });

        it("works in mock mode with unknown params", async () => {
          const router = new Router(parsedExample, { mockMode: true });
          const result = await router.call("addition", [6, 2]);
          expect(typeof result).toBe("number");
        });
      }
    });
  });
});
