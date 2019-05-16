import WebSocketTransport, { IWebSocketServerTransportOptions } from "./websocket";
import HTTPTransport, { IHTTPServerTransportOptions } from "./http";
import HTTPSTransport, { IHTTPSServerTransportOptions } from "./https";
import IPCTransport, { IIPCServerTransportOptions } from "./ipc";
import Transport from "./server-transport";

export type TTransportNames = "IPCTransport" | "HTTPTransport" | "HTTPSTransport" | "WebSocketTransport";

export type TTransportClasses = WebSocketTransport |
  HTTPTransport |
  HTTPSTransport |
  IPCTransport;

export type TTransportOptions = IWebSocketServerTransportOptions |
  IHTTPServerTransportOptions |
  IHTTPSServerTransportOptions |
  IIPCServerTransportOptions;

export interface ITransportsMapping { [name: string]: any; }

const transports: ITransportsMapping = {
  HTTPSTransport,
  HTTPTransport,
  IPCTransport,
  WebSocketTransport,
};

export default transports;
