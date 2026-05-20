import { randomUUID } from "crypto";
import type { WebSocket } from "ws";

interface AgentSession {
  id: string;
  ws: WebSocket;
  agentName?: string;
  connectedAt: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 60_000;

export class SessionManager {
  private agentSessions = new Map<string, AgentSession>();
  private extensionConnection: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private tabSessions = new Map<string, number[]>();

  addAgent(ws: WebSocket, agentName?: string): string {
    const id = randomUUID();
    this.agentSessions.set(id, { id, ws, agentName, connectedAt: Date.now() });
    return id;
  }

  removeAgent(id: string): void {
    this.agentSessions.delete(id);
  }

  getAgent(id: string): AgentSession | undefined {
    return this.agentSessions.get(id);
  }

  setExtension(ws: WebSocket): void {
    this.extensionConnection = ws;

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.id);
          if (msg.type === "error") {
            pending.reject(new Error(msg.payload.message));
          } else {
            pending.resolve(msg.payload.result);
          }
        }
      } catch {
        // Ignore parse errors on relayed messages
      }
    });

    ws.on("close", () => {
      this.extensionConnection = null;
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error("extension_disconnected"));
        this.pendingRequests.delete(id);
      }
    });
  }

  hasExtension(): boolean {
    return this.extensionConnection !== null;
  }

  async sendToExtension(message: unknown): Promise<unknown> {
    if (!this.extensionConnection) {
      throw new Error("no_extension_connected");
    }

    const msg = message as { id: string };
    const id = msg.id;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("request_timeout"));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.extensionConnection!.send(JSON.stringify(message));
    });
  }

  addTabSession(sessionName: string, tabId: number): void {
    const tabs = this.tabSessions.get(sessionName) || [];
    if (!tabs.includes(tabId)) {
      tabs.push(tabId);
    }
    this.tabSessions.set(sessionName, tabs);
  }

  removeTabSession(sessionName: string, tabId: number): void {
    const tabs = this.tabSessions.get(sessionName);
    if (tabs) {
      const idx = tabs.indexOf(tabId);
      if (idx !== -1) {
        tabs.splice(idx, 1);
      }
      if (tabs.length === 0) {
        this.tabSessions.delete(sessionName);
      }
    }
  }

  getSessionTabs(sessionName: string): number[] {
    return this.tabSessions.get(sessionName) || [];
  }

  getAllTabs(): number[] {
    const all: number[] = [];
    for (const tabs of this.tabSessions.values()) {
      all.push(...tabs);
    }
    return all;
  }

  getAgentCount(): number {
    return this.agentSessions.size;
  }
}
