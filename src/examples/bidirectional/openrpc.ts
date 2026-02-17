import { OpenrpcDocument as OpenRPC } from "@open-rpc/meta-schema";

const bidirectionalOpenRPCDocument: OpenRPC = {
  openrpc: "1.2.6",
  info: {
    title: "Bidirectional Example",
    version: "1.0.0",
  },
  methods: [
    {
      name: "serverHello",
      summary: "Implemented by the server only.",
      params: [{ name: "name", schema: { type: "string" } }],
      result: { name: "message", schema: { type: "string" } },
      "x-implementedBy": ["server"],
    },
    {
      name: "clientHello",
      summary: "Implemented by the client only.",
      params: [{ name: "name", schema: { type: "string" } }],
      result: { name: "message", schema: { type: "string" } },
      "x-implementedBy": ["client"],
    },
    {
      name: "bounce",
      summary: "Implemented by both client and server.",
      params: [{ name: "text", schema: { type: "string" } }],
      result: { name: "message", schema: { type: "string" } },
      "x-implementedBy": ["server", "client"],
    },
    {
      name: "serverCallsClient",
      summary: "Server method that calls client methods via injected client proxy.",
      params: [{ name: "name", schema: { type: "string" } }],
      result: { name: "message", schema: { type: "string" } },
      "x-implementedBy": ["server"],
    },
  ],
};

export default bidirectionalOpenRPCDocument;
