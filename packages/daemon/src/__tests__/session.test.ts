import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../session.js";

describe("SessionManager", () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  it("should add and get agent sessions", () => {
    const mockWs = {} as WebSocket;
    const id = sm.addAgent(mockWs, "test-agent");
    expect(id).toBeTruthy();
    expect(sm.getAgent(id)?.agentName).toBe("test-agent");
  });

  it("should remove agent sessions", () => {
    const mockWs = {} as WebSocket;
    const id = sm.addAgent(mockWs);
    sm.removeAgent(id);
    expect(sm.getAgent(id)).toBeUndefined();
  });

  it("should track extension connection", () => {
    expect(sm.hasExtension()).toBe(false);
    const mockWs = { on: () => {}, send: () => {} } as unknown as WebSocket;
    sm.setExtension(mockWs);
    expect(sm.hasExtension()).toBe(true);
  });

  it("should manage tab sessions", () => {
    sm.addTabSession("session-a", 1);
    sm.addTabSession("session-a", 2);
    sm.addTabSession("session-b", 3);

    expect(sm.getSessionTabs("session-a")).toEqual([1, 2]);
    expect(sm.getSessionTabs("session-b")).toEqual([3]);

    sm.removeTabSession("session-a", 1);
    expect(sm.getSessionTabs("session-a")).toEqual([2]);
  });

  it("should return agent count", () => {
    expect(sm.getAgentCount()).toBe(0);
    sm.addAgent({} as WebSocket);
    sm.addAgent({} as WebSocket);
    expect(sm.getAgentCount()).toBe(2);
  });

  it("should throw when sending to extension with no connection", async () => {
    await expect(sm.sendToExtension({ id: "test" })).rejects.toThrow(
      "no_extension_connected"
    );
  });
});
