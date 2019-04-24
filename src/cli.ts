import program from "commander";
import { Server } from "./";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { inspect } from "util";
import generate from "./generator";
import * as fs from "fs";
import * as util from "util";
import { keyBy, flatten, chain } from "lodash";
import { IMethodMapping } from "./router";
import { resolve } from "path";

const readDir = util.promisify(fs.readdir);

const basePath = "./src/method-handlers";

let methodMapping;
try {
  methodMapping = import(`${process.cwd()}/src/method-handlers)`);
} catch(e) {
  console.log("no method mapping");
  console.log(e)
}

program
  .version("1.0.0")
  .option("-d, --document <documentLocation>", "JSON string or a Path/Url pointing to an OpenROC document");

program
  .command("start")
  .action(async (env, options) => {
    console.log("Starting server with the following options:");
    const methodFilenames = await readDir(basePath);

    const baba = `${process.cwd()}/src/method-handlers`;
    const methodMapping = await import(baba);

    // const readMethodsPromises = methodFilenames.map(async (methodFilename) => {
    //   const methodPath = `./method-handlers/${methodFilename}`.replace(".ts", "");
    //   const name = methodFilename.replace(".ts", "");
    //   const methodHandler = await import(methodPath);

    //   return { name, fn: methodHandler.default };
    // });

    // const allMethodHandlers = flatten(await Promise.all(readMethodsPromises));

    // const methodHandlerMap = chain(allMethodHandlers)
    //   .keyBy("name")
    //   .mapValues("fn")
    //   .value();

    console.log(inspect(methodMapping));
  });

if (require.main === module) {
  program.parse(process.argv);
} else {
  module.exports = program;
}
