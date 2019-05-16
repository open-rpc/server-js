#!/usr/bin/env node

import program from "commander";
import { Server } from "./";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { inspect } from "util";
import * as fs from "fs";
import * as util from "util";
import { keyBy, flatten, chain } from "lodash";
import { IMethodMapping } from "./router";
import { resolve } from "path";

const version = require("../package.json").version; // tslint:disable-line

const readDir = util.promisify(fs.readdir);
const basePath = "./src/method-handlers";

let methodMapping;
try {
  methodMapping = import(`${process.cwd()}/src/method-handlers)`);
} catch (e) {
  console.log("no method mapping"); // tslint:disable-line
  console.log(e); // tslint:disable-line
}

program
  .option("-d, --document <documentLocation>", "JSON string or a Path/Url pointing to an OpenROC document");

program
  .version(version, "-v, --version")
  .command("start")
  .action(async (env, options) => {
    const methodFilenames = await readDir(basePath);

    const baba = `${process.cwd()}/src/method-handlers`;
    // const methodMapping = await import(baba);

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

  });

if (require.main === module) {
  program.parse(process.argv);
} else {
  module.exports = program;
}
