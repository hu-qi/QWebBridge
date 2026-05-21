#!/usr/bin/env node

import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
import { writePid, readPid, removePid, loadConfig, getLogFile, writeLog, CONFIG_DIR } from "../config.js";
import { DAEMON_PORT } from "@qweb/protocol";
import { spawn } from "child_process";
import { existsSync, rmSync, mkdirSync, cpSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const command = process.argv[2];
const VERSION = "1.0.0";

async function main() {
  switch (command) {
    case "start": {
      // Check if already running
      const existingPid = readPid();
      if (existingPid) {
        try {
          process.kill(existingPid, 0);
          console.log("[qweb-bridge] Daemon is already running (pid " + existingPid + ")");
          console.log("Run 'qweb-bridge restart' to restart");
          process.exit(0);
        } catch {
          // Stale PID, ignore
        }
      }

      const child = spawn(process.execPath, [process.argv[1], "run", "--daemon"], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      child.unref();

      // Wait a moment then check if it's up
      await new Promise((r) => setTimeout(r, 1500));

      const newPid = readPid();
      if (newPid) {
        console.log("[qweb-bridge] Daemon started (pid " + newPid + ")");
      } else {
        console.log("[qweb-bridge] Daemon may still be starting...");
        console.log("Check: qweb-bridge status");
      }
      process.exit(0);
    }

    case "run": {
      const isDaemon = process.argv.includes("--daemon");
      const sm = new SessionManager();
      const { httpServer } = await createServer(sm);

      if (isDaemon) {
        writePid(process.pid!);
      } else {
        writePid(process.pid!);
      }

      writeLog("Daemon started (pid " + process.pid + ")");

      // Write logs to file while also showing on stdout
      const origLog = console.log;
      const origError = console.error;
      console.log = (...args: unknown[]) => {
        const msg = args.map(String).join(" ");
        writeLog(msg);
        origLog.apply(console, args);
      };
      console.error = (...args: unknown[]) => {
        const msg = args.map(String).join(" ");
        writeLog("ERROR: " + msg);
        origError.apply(console, args);
      };

      const shutdown = () => {
        console.log("[qweb-bridge] Shutting down...");
        writeLog("Daemon shutting down");
        httpServer.close();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      break;
    }

    case "stop": {
      const pid = readPid();
      if (!pid) {
        console.log("[qweb-bridge] Daemon is not running");
        process.exit(0);
      }

      try {
        process.kill(pid, "SIGTERM");
        // Wait for it to stop
        await new Promise<void>((resolve) => {
          let tries = 0;
          const check = () => {
            tries++;
            try {
              process.kill(pid, 0);
              if (tries < 10) setTimeout(check, 200);
              else resolve();
            } catch {
              resolve();
            }
          };
          setTimeout(check, 200);
        });
        console.log("[qweb-bridge] Daemon stopped");
      } catch {
        console.log("[qweb-bridge] Daemon is not running");
      }
      removePid();
      process.exit(0);
    }

    case "restart": {
      const oldPid = readPid();
      if (oldPid) {
        try {
          process.kill(oldPid, "SIGTERM");
          await new Promise((r) => setTimeout(r, 1000));
        } catch {}
      }
      // Re-execute start
      const child = spawn(process.execPath, [process.argv[1], "run", "--daemon"], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      child.unref();
      await new Promise((r) => setTimeout(r, 1500));
      const newPid = readPid();
      if (newPid) {
        console.log("[qweb-bridge] Daemon restarted (pid " + newPid + ")");
      } else {
        console.log("[qweb-bridge] Restart may still be in progress...");
      }
      process.exit(0);
    }

    case "status": {
      try {
        const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/health`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.log(JSON.stringify({
          running: false,
          port: DAEMON_PORT,
          version: VERSION,
        }, null, 2));
      }
      process.exit(0);
    }

    case "logs": {
      const logFile = getLogFile();
      if (!existsSync(logFile)) {
        console.log("[qweb-bridge] No logs found");
        process.exit(0);
      }

      let lines = 100;
      let follow = false;
      let prev = false;

      const args = process.argv.slice(3);
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-n") lines = parseInt(args[++i], 10) || 100;
        else if (args[i] === "-f") follow = true;
        else if (args[i] === "--prev") prev = true;
      }

      const targetFile = prev ? getLogFile() + ".prev" : logFile;

      if (!existsSync(targetFile)) {
        console.log("[qweb-bridge] No logs found");
        process.exit(0);
      }

      const content = readFileSync(targetFile, "utf-8").trim();
      const allLines = content ? content.split("\n") : [];
      const tailLines = allLines.slice(-lines);
      console.log(tailLines.join("\n"));

      if (follow) {
        let lastSize = readFileSync(targetFile).length;
        setInterval(() => {
          try {
            const current = readFileSync(targetFile, "utf-8");
            if (current.length > lastSize) {
              process.stdout.write(current.slice(lastSize));
              lastSize = current.length;
            }
          } catch {}
        }, 1000);
        // Keep alive
        setInterval(() => {}, 60000);
      }
      break;
    }

    case "install-skill": {
      const skillDir = join(homedir(), ".agents", "skills", "qweb-bridge");
      // Search in multiple locations
      const candidates = [
        join(process.cwd(), "packages", "skill", "qweb-bridge"),
        join(CONFIG_DIR, "repo", "packages", "skill", "qweb-bridge"),
        join(__dirname, "..", "..", "..", "..", "packages", "skill", "qweb-bridge"),
      ];
      let skillSource = "";
      for (const c of candidates) {
        if (existsSync(join(c, "SKILL.md"))) { skillSource = c; break; }
      }
      if (skillSource) {
        if (existsSync(skillDir)) rmSync(skillDir, { recursive: true });
        mkdirSync(join(homedir(), ".agents", "skills"), { recursive: true });
        cpSync(skillSource, skillDir, { recursive: true });
        console.log("✓ Skill installed to " + skillDir);
      } else {
        console.log("! Skill source not found at " + skillSource);
        console.log("  Run this command from the QwebBridge project root");
      }
      process.exit(0);
    }

    case "uninstall": {
      const qDir = CONFIG_DIR;
      if (existsSync(qDir)) {
        // Stop daemon first
        const pid = readPid();
        if (pid) {
          try {
            process.kill(pid, "SIGTERM");
            await new Promise((r) => setTimeout(r, 500));
          } catch {}
        }
        rmSync(qDir, { recursive: true });
        console.log("✓ Removed " + qDir);
      }

      const skillDir = join(homedir(), ".agents", "skills", "qweb-bridge");
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true });
        console.log("✓ Removed skill at " + skillDir);
      }
      console.log("[qweb-bridge] Uninstalled");
      process.exit(0);
    }

    case "shutdown": {
      const config = loadConfig();
      try {
        await fetch(`http://127.0.0.1:${config.port}/shutdown`, { method: "POST" });
        console.log("[qweb-bridge] Shutdown signal sent");
      } catch {
        console.log("[qweb-bridge] Daemon is not running");
      }
      process.exit(0);
    }

    case "version":
    case "--version":
    case "-v": {
      console.log("qweb-bridge v" + VERSION);
      break;
    }

    case "install": {
      console.log("[qweb-bridge] Install instructions:");
      console.log("  1. Run: qweb-bridge run");
      console.log("  2. Load Chrome extension from packages/extension/dist");
      console.log("     Open chrome://extensions, enable Developer mode,");
      console.log("     click 'Load unpacked' and select the dist folder");
      break;
    }

    case "mcp": {
      const { createServer } = await import("../server.js");
      const { SessionManager } = await import("../session.js");
      const { writePid } = await import("../config.js");
      const sm = new SessionManager();
      const { httpServer } = await createServer(sm);
      writePid(process.pid);

      const { createMCPAdapter } = await import("../adapters/mcp.js");
      createMCPAdapter(sm);

      process.on("SIGINT", () => { httpServer.close(); process.exit(0); });
      process.on("SIGTERM", () => { httpServer.close(); process.exit(0); });
      break;
    }

    default: {
      console.log("qweb-bridge v" + VERSION + " - Browser bridge for AI agents");
      console.log("");
      console.log("Usage: qweb-bridge <command>");
      console.log("");
      console.log("Commands:");
      console.log("  start          Start the daemon (background)");
      console.log("  stop           Stop the daemon");
      console.log("  restart        Restart the daemon");
      console.log("  status         Show daemon status");
      console.log("  run            Start the daemon (foreground)");
      console.log("  shutdown       Stop the daemon via HTTP");
      console.log("  logs           Show daemon logs");
      console.log("  install        Show installation instructions");
      console.log("  install-skill  Install the qweb-bridge skill");
      console.log("  uninstall      Stop daemon and remove all data");
      console.log("  mcp            Start MCP server");
      console.log("  version        Show version");
      break;
    }
  }
}

main().catch(console.error);
