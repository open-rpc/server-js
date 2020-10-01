import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import MQTTTransport from "./mqtt";

// import fetch from "node-fetch";
import { JSONRPCResponse } from "./server-transport";

describe('mqtt transport', () => {
  let transport: MQTTTransport;
  beforeAll(async () => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    transport = new MQTTTransport({
      broker: "tcp://localhost:1883",
      inTopic: "inTopic",
      outTopic: "outTopic"
    });

    const router = new Router(simpleMathExample, { mockMode: true });

    transport.addRouter(router);

    await transport.connect();
  });

  afterAll(() => {
    transport.end();
  })

  it("can connect to the broker", () => {
    expect(transport.client.connected).toBeTruthy()
  })
});
