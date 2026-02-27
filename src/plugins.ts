import { MethodObject } from "@open-rpc/meta-schema";
import { RouterPlugin } from "./router";

const getImplementedBy = (methodObject?: MethodObject): string[] => {
  if (!methodObject) {
    return [];
  }

  const implementedBy = (methodObject as MethodObject & { [key: string]: unknown })["x-implemented-by"];
  if (implementedBy === undefined) {
    return ["server"];
  }

  if (implementedBy instanceof Array) {
    return implementedBy.filter((role): role is string => typeof role === "string");
  }

  return [];
};

export const implementedByPlugin = (): RouterPlugin => ({
  name: "implemented-by",
  isMethodImplemented: ({ methodName, methodObject, context }) => {
    if (methodName === "rpc.discover") {
      return true;
    }

    const participant = (context?.participant as string | undefined) || "server";
    return getImplementedBy(methodObject).includes(participant);
  },
  listMethods: ({ methods, context }) => {
    const participant = (context?.participant as string | undefined) || "server";
    return methods
      .filter((method) => getImplementedBy(method).includes(participant))
      .map((method) => method.name);
  },
  mapHandlerParams: ({ paramsAsArray, context }) => {
    if (!context || context.client === undefined) {
      return paramsAsArray;
    }
    return [...paramsAsArray, context.client];
  },
});

