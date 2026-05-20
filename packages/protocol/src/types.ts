// === Identity ===

export interface DeviceIdentity {
  device_id: string;
}

// === Message Envelope ===

export type MessageType = "hello" | "command" | "response" | "error" | "event";

export interface Message<T = unknown> {
  id: string;
  type: MessageType;
  payload: T;
}

// === Hello (Handshake) ===

export interface HelloPayload {
  agent?: string;
  version?: string;
  capabilities?: string[];
}

// === Command ===

export interface CommandRequest {
  tool: string;
  params: Record<string, unknown>;
  session?: string;
}

export interface CommandResponse<T = unknown> {
  result: T;
}

// === Error ===

export interface ErrorDetail {
  code: string;
  message: string;
  details?: string;
}

// === Event (alive ping, etc.) ===

export interface DaemonAliveEvent {
  arch: string;
  daemon_version: string;
  os: string;
}
