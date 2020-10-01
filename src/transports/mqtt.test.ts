import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import MQTTTransport from "./mqtt";
import AsyncMQTT from "async-mqtt";
import Aedes from "aedes";
import Net from "net";

import { JSONRPCResponse } from "./server-transport";

describe('mqtt transport', () => {
  const mqttBroker = Net.createServer(Aedes().handle);
  const mqttOptions = {
    broker: "tcp://localhost:1883",
    inTopic: "inTopic",
    outTopic: "outTopic"
  }
  let transport: MQTTTransport;
  let mqttClient: AsyncMQTT.AsyncClient;
  beforeAll(async () => {

    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    transport = new MQTTTransport(mqttOptions);

    const router = new Router(simpleMathExample, { mockMode: true });

    transport.addRouter(router);

    mqttBroker.listen(1883)
    await transport.connect();
    mqttClient = await AsyncMQTT.connectAsync(mqttOptions.broker)
    mqttClient.subscribe(mqttOptions.outTopic)
  });

  afterAll(() => {
    transport.end();
    mqttBroker.close();
  })

  it("can connect to the broker", () => {
    expect(transport.client?.connected).toBeTruthy()
  })

  it("can answer to simple JSON-RPC", (done) => {
    const messageHandler = (topic: string, payload: Buffer) => {
      const response = JSON.parse(payload.toString())
      expect(response.result).toBe(4);
      mqttClient.off('message', messageHandler)
      done()
    }
    mqttClient.on('message', messageHandler)

    mqttClient.publish(mqttOptions.inTopic, JSON.stringify({
      id: "0",
      jsonrpc: "2.0",
      method: "addition",
      params: [2, 2],
    }))
  })
});
