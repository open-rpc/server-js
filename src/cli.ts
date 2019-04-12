import program from "commander";
import { Server } from "./";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { inspect } from "util";

program
  .version(require("./get-version"))

program
  .command("init")
  .action(async (env, options) => {
    console.log("Initializing a new project with the following options:");
    console.log(inspect(options));
  });

program
  .command("generate")
  .option("-s, --schema [schema]", "JSON string or a Path/Url pointing to an open rpc schema")
  .action(async (env, options) => {
    console.log("Generating server boilerplate with the following options:");
  });

program
  .command("start")
  .option("-s, --schema [schema]", "JSON string or a Path/Url pointing to an open rpc schema")
  .action(async (env, options) => {
    console.log("Starting server with the following options:");
  });

if (require.main === module) {
  program.parse(process.argv);
} else {
  module.exports = program;
}
