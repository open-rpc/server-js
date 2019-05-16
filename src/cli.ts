#!/usr/bin/env node

import program from "commander";
import { Server } from "./";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { inspect } from "util";
import * as fs from "fs";
import loadMethodHandlerMapping from "./load-method-handler-mapping";

const cwd = process.cwd();

const init = async () => {
  let methodMapping;
  const { version } = await import(`../package.json`);
  try {
    methodMapping = await import(`${cwd}/src/method-handlers)`);
  } catch (e) {
    console.log("no method mapping"); // tslint:disable-line
    console.log(e); // tslint:disable-line
  }
  program
    .version(version, "-v, --version")

    .option("-d, --document <string>", "JSON string or a Path/Url pointing to an OpenROC document")
    .option("-m, --methodHandlersDirectory <string>", "directory containing method handlers")

    .command("start")
    .action(async (env, options) => {
      const methodHandlerMapping = loadMethodHandlerMapping(cwd);
      console.log('wip'); // tslint:disable-line
    });
};

if (require.main === module) {
  init().then(() => program.parse(process.argv));
} else {
  module.exports = program;
}
