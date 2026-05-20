#!/usr/bin/env node

import { createServer } from "../server.js";
import { SessionManager } from "../session.js";
import { writePid, loadConfig } from "../config.js";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "run": {
      const sm = new SessionManager();
      const { httpServer } = await createServer(sm);
      writePid(process.pid);

      const shutdown = () => {
        console.log("[qweb-bridge] Shutting down...");
        httpServer.close();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      break;
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

    case "version":
    case "--version":
    case "-v": {
      console.log("qweb-bridge v1.0.0");
      break;
    }

    default: {
      console.log("qweb-bridge - Browser bridge for AI agents");
      console.log("");
      console.log("Usage: qweb-bridge <command>");
      console.log("");
      console.log("Commands:");
      console.log("  run        Start the daemon");
      console.log("  shutdown   Stop the daemon");
      console.log("  install    Show installation instructions");
      console.log("  version    Show version");
      break;
    }
  }
}

main().catch(console.error);
