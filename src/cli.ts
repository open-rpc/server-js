import program from "commander";
import { Server } from "./";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { inspect } from "util";
import generate from "./generator";

program
  .version("1.0.0")
  .option("-d, --document <documentLocation>", "JSON string or a Path/Url pointing to an OpenROC document");

program
  .command("init")
  .action(async (env, options) => {
    console.log("Initializing a new project with the following options:");
    console.log(inspect(options));
  });

program
  .command("generate")
  .action(async (env, options) => {
    const openrpcDocument = await parseOpenRPCDocument(program.document);
    console.log(`Generating code for ${openrpcDocument.info.title}`);
    generate({ outputDir: "./nips", openrpcDocument });
  });

program
  .command("start")
  .action(async (env, options) => {
    console.log("Starting server with the following options:");
  });

if (require.main === module) {
  program.parse(process.argv);
} else {
  module.exports = program;
}
