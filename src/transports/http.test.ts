// import examples from "@open-rpc/examples";
// import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
// import { Router } from "../router";
// import HTTPTransport from "./http";
// import fetch from "node-fetch";
// import { JSONRPCResponse } from "./server-transport";

// describe("http transport", () => {
//   let transport: HTTPTransport;
//   beforeAll(async () => {
//     const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
//     transport = new HTTPTransport({
//       middleware: [],
//       port: 9696,
//     });

//     const router = new Router(simpleMathExample, { mockMode: true });

//     transport.addRouter(router);

//     transport.start();
//   });

//   afterAll(() => {
//     transport.stop();
//   });

//   it("can start an http server that works", async () => {
//     const { result } = await fetch("http://localhost:9696", {
//       body: JSON.stringify({
//         id: "0",
//         jsonrpc: "2.0",
//         method: "addition",
//         params: [2, 2],
//       }),
//       headers: { "Content-Type": "application/json" },
//       method: "post",
//     }).then((res) => res.json());

//     expect(result).toBe(4);
//   });
//   it("works with batching", async () => {
//     const result = await fetch("http://localhost:9696", {
//       body: JSON.stringify([
//         {
//           id: "0",
//           jsonrpc: "2.0",
//           method: "addition",
//           params: [2, 2],
//         }, {
//           id: "1",
//           jsonrpc: "2.0",
//           method: "addition",
//           params: [4, 4],
//         },
//       ]),
//       headers: { "Content-Type": "application/json" },
//       method: "post",
//     }).then((res) => res.json());

//     const pluckedResult = result.map((r: JSONRPCResponse) => r.result);
//     expect(pluckedResult).toEqual([4, 8]);
//   });
// });
