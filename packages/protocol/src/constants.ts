export const TOOL_NAMES = [
  "navigate",
  "snapshot",
  "screenshot",
  "click",
  "fill",
  "evaluate",
  "mouse_click",
  "key_type",
  "send_keys",
  "upload",
  "network",
  "find_tab",
  "list_tabs",
  "close_tab",
  "close_session",
  "save_as_pdf",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const ERROR_CODES = {
  TOOL_NOT_FOUND: "tool_not_found",
  TAB_NOT_FOUND: "tab_not_found",
  ELEMENT_NOT_FOUND: "element_not_found",
  INVALID_PARAMS: "invalid_params",
  CDP_ERROR: "cdp_error",
  SESSION_CLOSED: "session_closed",
  EXTENSION_DISCONNECTED: "extension_disconnected",
  NO_EXTENSION_CONNECTED: "no_extension_connected",
  NAVIGATION_FAILED: "navigation_failed",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const DAEMON_PORT = 10086;
export const WS_PATH = "selector/command";
export const HEARTBEAT_INTERVAL_MS = 30_000;

export const TAB_GROUP_COLORS: Record<string, string> = {
  twitter: "blue",
  xhs: "red",
  zhihu: "blue",
  worldquant: "purple",
};

export const FALLBACK_COLORS = [
  "green",
  "yellow",
  "cyan",
  "orange",
  "pink",
  "grey",
] as const;
