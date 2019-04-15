import { OpenRPC } from "@open-rpc/meta-schema";
import { resolve } from "path";
import { mkdir, writeFile } from "fs-extra";
import template from "./template";
import tsGenerator from "@open-rpc/generator-client/build/src/generators/typescript";

export interface IGenerateOptions {
  openrpcDocument: OpenRPC;
  outputDir: string;
}

export default async function generate(options: IGenerateOptions) {
  const version = options.openrpcDocument.info.version;
  const basePath = resolve(`${options.outputDir}/{version}`);

  console.log("Making directory for version");
  await mkdir(basePath);

  const methods = options.openrpcDocument.methods;
  const typeDefs = await tsGenerator.getMethodTypingsMap(options.openrpcDocument);
  methods.forEach(async (method) => {
    const clientBasedFunctionSignature = await tsGenerator.getFunctionSignature(method, typeDefs);

    const serverFunctionSignature = clientBasedFunctionSignature.replace("public ", "export default function");
    const generatedCode = template({
      functionSignature: tsGenerator.getFunctionSignature(method, typeDefs),
      method,
    });

    const fileNameForMethod = `${basePath}/${method.name}.ts`;
    console.log(`Writing to ${fileNameForMethod}`);
    await writeFile(fileNameForMethod, generatedCode);
  });
}
