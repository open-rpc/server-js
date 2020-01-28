import * as fs from "fs";
import * as util from "util";
import { flatten, chain } from "lodash";
const readDir = util.promisify(fs.readdir);

export default async function loadMethodHandlerMapping(basePath: string) {
  const methodFilenames = await readDir(basePath);

  const readMethodsPromises = methodFilenames.map(async (methodFilename) => {
    const methodPath = `../method-handlers/${methodFilename}`.replace(".ts", "");
    const name = methodFilename.replace(".ts", "");
    const methodHandler = await import(methodPath);

    return { name, fn: methodHandler.default };
  });

  const allMethodHandlers = flatten(await Promise.all(readMethodsPromises));

  return chain(allMethodHandlers)
    .keyBy("name")
    .mapValues("fn")
    .value();
}
