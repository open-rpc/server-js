import WebSocketTransport, { TWebSocketServerTransportOptions } from "./websocket";
import HTTPTransport, { THTTPServerTransportOptions } from "./http";
import HTTPSTransport, { THTTPSServerTransportOptions } from "./https";
import IPCTransport, { TIPCServerTransportOptions } from "./ipc";
import Transport from "./server-transport";

export type TTransportNames = "IPCTransport" | "HTTPTransport" | "HTTPSTransport" | "WebSocketServerTransport";

export type TTransportClasses = WebSocketTransport |
  HTTPTransport |
  HTTPSTransport |
  IPCTransport;

export type TTransportOptions = TWebSocketServerTransportOptions |
  THTTPServerTransportOptions |
  THTTPSServerTransportOptions |
  TIPCServerTransportOptions;

export interface ITransportsMapping { [name: string]: any; }

const transports: ITransportsMapping = {
  HTTPSTransport,
  HTTPTransport,
  IPCTransport,
  WebSocketTransport,
};

export default transports;
