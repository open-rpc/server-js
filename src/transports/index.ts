import WebSocketTransport, { WebSocketServerTransportOptions } from "./websocket";
import HTTPTransport, { HTTPServerTransportOptions } from "./http";
import HTTPSTransport, { HTTPSServerTransportOptions } from "./https";
import IPCTransport, { IPCServerTransportOptions } from "./ipc";
import { ServerTransport } from "./server-transport";
export {HTTPSTransport, HTTPTransport, WebSocketTransport, IPCTransport, ServerTransport}

export type TransportNames = "IPCTransport" | "HTTPTransport" | "HTTPSTransport" | "WebSocketTransport";

export type TransportClasses = WebSocketTransport |
  HTTPTransport |
  HTTPSTransport |
  IPCTransport | ServerTransport;

export type TransportOptions = WebSocketServerTransportOptions |
  HTTPServerTransportOptions |
  HTTPSServerTransportOptions |
  IPCServerTransportOptions;

export interface TransportsMapping {
  [name: string]: any;
}

const transports: TransportsMapping = {
  HTTPSTransport,
  HTTPTransport,
  IPCTransport,
  WebSocketTransport,
};

export default transports;
