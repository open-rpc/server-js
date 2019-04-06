import { Router, IMethodMapping } from "./router";
import examples from "@open-rpc/examples";
import _ from "lodash";
import { parse } from "@open-rpc/schema-utils-js";
import { types } from "@open-rpc/meta-schema";
const jsf = require("json-schema-faker"); // tslint:disable-line

const makeMethodMapping = (methods: types.MethodObject[]): IMethodMapping => {
  return _.chain(methods)
    .keyBy("name")
    .mapValues((methodObject: types.MethodObject) => async (...args: any): Promise<any> => {
      const foundExample = _.find(
        methodObject.examples as types.ExamplePairingObject[],
        ({ params }) => _.isMatch(_.map(params, "value"), args),
      );
      if (foundExample) {
        const foundExampleResult = foundExample.result as types.ExampleObject;
        return Promise.resolve({ result: foundExampleResult.value });
      } else {
        const result = methodObject.result as types.ContentDescriptorObject;
        return { result: await jsf.generate(result.schema) };
      }
    })
    .value();
};

describe("router", () => {
  _.forEach(examples, (example, exampleName) => {
    describe(exampleName, () => {

      let parsedExample: types.OpenRPC;
      beforeAll(async () => {
        parsedExample = await parse(JSON.stringify(example));
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
          const { result } = await router.call("addition", [2, 2]);
          expect(result).toBe(4);
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
          const { result } = await router.call("addition", [2, 2]);
          expect(result).toBe(4);
        });

        it("works in mock mode with unknown params", async () => {
          const router = new Router(parsedExample, { mockMode: true });
          const { result } = await router.call("addition", [6, 2]);
          expect(typeof result).toBe("number");
        });
      }
    });
  });
});
