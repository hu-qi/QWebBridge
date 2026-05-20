import { describe, it, expect } from "vitest";
import { TOOL_NAMES, ERROR_CODES, DAEMON_PORT, WS_PATH } from "../constants.js";
import type { Message, CommandRequest, CommandResponse, ErrorDetail, HelloPayload } from "../types.js";

describe("Constants", () => {
  it("should have exactly 16 tool names", () => {
    expect(TOOL_NAMES).toHaveLength(16);
  });

  it("should have all required tool names", () => {
    expect(TOOL_NAMES).toContain("navigate");
    expect(TOOL_NAMES).toContain("snapshot");
    expect(TOOL_NAMES).toContain("screenshot");
    expect(TOOL_NAMES).toContain("click");
    expect(TOOL_NAMES).toContain("fill");
    expect(TOOL_NAMES).toContain("evaluate");
    expect(TOOL_NAMES).toContain("mouse_click");
    expect(TOOL_NAMES).toContain("key_type");
    expect(TOOL_NAMES).toContain("send_keys");
    expect(TOOL_NAMES).toContain("upload");
    expect(TOOL_NAMES).toContain("network");
    expect(TOOL_NAMES).toContain("find_tab");
    expect(TOOL_NAMES).toContain("list_tabs");
    expect(TOOL_NAMES).toContain("close_tab");
    expect(TOOL_NAMES).toContain("close_session");
    expect(TOOL_NAMES).toContain("save_as_pdf");
  });

  it("should define all error codes", () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(9);
  });

  it("should use correct port", () => {
    expect(DAEMON_PORT).toBe(10086);
  });

  it("should use correct WS path", () => {
    expect(WS_PATH).toBe("selector/command");
  });
});

describe("Message serialization round-trip", () => {
  it("should serialize and deserialize Hello message", () => {
    const msg: Message<HelloPayload> = {
      id: "1",
      type: "hello",
      payload: { agent: "claude-code", version: "1.0" },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<HelloPayload>;
    expect(parsed.type).toBe("hello");
    expect(parsed.payload.agent).toBe("claude-code");
  });

  it("should serialize and deserialize Command message", () => {
    const msg: Message<CommandRequest> = {
      id: "2",
      type: "command",
      payload: {
        tool: "navigate",
        params: { url: "https://example.com" },
        session: "test-session",
      },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<CommandRequest>;
    expect(parsed.type).toBe("command");
    expect(parsed.payload.tool).toBe("navigate");
    expect(parsed.payload.session).toBe("test-session");
  });

  it("should serialize and deserialize Response message", () => {
    const msg: Message<CommandResponse> = {
      id: "2",
      type: "response",
      payload: { result: { success: true, url: "https://example.com", tabId: 42 } },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<CommandResponse>;
    expect(parsed.type).toBe("response");
  });

  it("should serialize and deserialize Error message", () => {
    const msg: Message<ErrorDetail> = {
      id: "3",
      type: "error",
      payload: { code: "tool_not_found", message: "Unknown tool: foo" },
    };
    const json = JSON.stringify(msg);
    const parsed = JSON.parse(json) as Message<ErrorDetail>;
    expect(parsed.type).toBe("error");
    expect(parsed.payload.code).toBe("tool_not_found");
  });
});
