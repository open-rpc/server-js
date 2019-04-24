import { OpenRPC } from "@open-rpc/meta-schema";
import { resolve, join } from "path";
import { writeFile, ensureDir } from "fs-extra";
import methodTemplate from "./method-template";
import methodMappingTemplate from "./method-mapping-template";
import { MethodTypings } from "@open-rpc/schema-utils-js";

export interface IGenerateOptions {
  openrpcDocument: OpenRPC;
  outputDir: string;
}

export default async function generate(options: IGenerateOptions) {
  const version = options.openrpcDocument.info.version;
  const basePath = options.outputDir;

  console.log("Making directory for version");
  await ensureDir(basePath);

  const methods = options.openrpcDocument.methods;
  const methodTypings = new MethodTypings(options.openrpcDocument);
  await methodTypings.generateTypings();

  methods.forEach(async (method) => {
    const clientBasedFunctionSignature = methodTypings.getFunctionSignature(method, "typescript");
    const functionSignature = clientBasedFunctionSignature.replace("public", "export default function");
    const generatedCode = methodTemplate({
      functionSignature,
      method,
      typeDefs: methodTypings.getTypeDefinitionsForMethod(method, "typescript"),
    });

    const fileNameForMethod = `${basePath}/${method.name}.ts`;
    console.log(`Writing to ${fileNameForMethod}`);
    await writeFile(fileNameForMethod, generatedCode);
  });

  const methodMapping = methodMappingTemplate({ methods: options.openrpcDocument.methods });
  const indexFilename = `${basePath}/index.ts`;
  await writeFile(indexFilename, methodMapping);
  console.log("wrote index file");
}
