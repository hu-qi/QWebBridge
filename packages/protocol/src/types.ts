// === Message Envelope ===

export type MessageType = "hello" | "hello_ack" | "tool_call" | "tool_result" | "error" | "event";

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

// === Tool Call ===

export interface ToolCallPayload {
  tool: string;
  params: Record<string, unknown>;
  session?: string;
}

export interface ToolResultPayload<T = unknown> {
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
  event: "webbridge_daemon_alive" | "webbridge_daemon_start";
  arch: string;
  daemon_version: string;
  os: string;
}

// === Handshake ===

export interface HelloAckPayload {
  status: string;
  session_id?: string;
  extensionVersion?: string;
}
