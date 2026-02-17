import WebSocket from "ws";

const URL = "ws://localhost:9850";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const ws = new WebSocket(URL);
const pending = new Map<string, PendingRequest>();
let nextRequestId = 0;

function sendRequest(method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `client-${nextRequestId++}`;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({
      id,
      jsonrpc: "2.0",
      method,
      params,
    }));
  });
}

function sendResult(id: string, result: unknown) {
  ws.send(JSON.stringify({
    id,
    jsonrpc: "2.0",
    result,
  }));
}

function sendError(id: string, message: string) {
  ws.send(JSON.stringify({
    id,
    jsonrpc: "2.0",
    error: {
      code: -32601,
      message,
    },
  }));
}

function handleIncomingRequest(payload: any) {
  if (!payload.id) {
    return;
  }

  if (payload.method === "clientHello") {
    const name = payload.params?.[0];
    sendResult(payload.id, `Hello ${name} (from client).`);
    return;
  }

  if (payload.method === "bounce") {
    const text = payload.params?.[0];
    sendResult(payload.id, `[client bounce] ${text}`);
    return;
  }

  sendError(payload.id, `Unknown method "${payload.method}"`);
}

function handleIncomingResponse(payload: any) {
  if (!payload.id) {
    return;
  }

  const pendingRequest = pending.get(payload.id);
  if (!pendingRequest) {
    return;
  }

  pending.delete(payload.id);
  if (payload.error) {
    pendingRequest.reject(new Error(payload.error.message || "Unknown JSON-RPC error"));
    return;
  }

  pendingRequest.resolve(payload.result);
}

ws.on("message", (raw) => {
  const payload = JSON.parse(raw.toString());
  if (payload.method) {
    handleIncomingRequest(payload);
    return;
  }
  handleIncomingResponse(payload);
});

ws.on("open", async () => {
  try {
    const hello = await sendRequest("serverHello", ["Alice"]);
    console.log("serverHello:", hello);

    const serverUsedClient = await sendRequest("serverCallsClient", ["Alice"]);
    console.log("serverCallsClient:", serverUsedClient);

    const bounce = await sendRequest("bounce", ["Hello from client"]);
    console.log("bounce:", bounce);
  } catch (err) {
    console.error("Client call failed:", err);
  } finally {
    ws.close();
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err);
});

ws.on("close", () => {
  process.exit(0);
});
