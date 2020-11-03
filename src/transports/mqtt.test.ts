import examples from "@open-rpc/examples";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import { Router } from "../router";
import MQTTTransport, { MQTTServerTransportOptions } from "./mqtt";
import AsyncMQTT from "async-mqtt";
import Aedes from "aedes";
import Net from "net";

describe('mqtt transport', () => {
  const mqttBroker = Net.createServer(Aedes().handle);
  const mqttOptions = {
    protocol: "tcp",
    host: "localhost",
    port: 1883,
    inTopic: "inTopic",
    outTopic: "outTopic"
  } as MQTTServerTransportOptions

  it("can answer to simple JSON-RPC", async (done) => {
    const simpleMathExample = await parseOpenRPCDocument(examples.simpleMath);
    const transport = new MQTTTransport(mqttOptions);

    const router = new Router(simpleMathExample, { mockMode: true });

    transport.addRouter(router);
    transport.start();
    const uri = `${mqttOptions.protocol}://${mqttOptions.host}:${mqttOptions.port}`;
    const mqttClient = await AsyncMQTT.connectAsync(uri)

    mqttClient.subscribe(mqttOptions.outTopic);

    const messageHandler = async (topic: string, payload: Buffer) => {
      const response = JSON.parse(payload.toString());
      mqttClient.off('message', messageHandler);
      await transport.stop();
      await mqttClient.end();
      expect(response.result).toBe(4);
      done();
    }

    mqttClient.on('message', messageHandler);

    await mqttClient.publish(mqttOptions.inTopic, JSON.stringify({
      id: "0",
      jsonrpc: "2.0",
      method: "addition",
      params: [2, 2],
    }));
  })
});
