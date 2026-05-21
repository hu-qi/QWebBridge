import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { randomBytes } from "crypto";

interface DeviceIdentity {
  device_id: string;
}

const CONFIG_DIR = join(homedir(), ".qweb-bridge");
const IDENTITY_FILE = join(CONFIG_DIR, "identity.json");
const PID_FILE = join(CONFIG_DIR, "daemon.pid");
const LOG_DIR = join(CONFIG_DIR, "logs");
const LOG_FILE = join(LOG_DIR, "daemon.log");

export interface DaemonConfig {
  port: number;
  identity: DeviceIdentity;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function generateDeviceId(): string {
  return randomBytes(12).toString("base64url");
}

export function loadIdentity(): DeviceIdentity {
  ensureDir(CONFIG_DIR);
  if (existsSync(IDENTITY_FILE)) {
    const raw = readFileSync(IDENTITY_FILE, "utf-8");
    return JSON.parse(raw) as DeviceIdentity;
  }
  const identity: DeviceIdentity = { device_id: generateDeviceId() };
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity));
  return identity;
}

export function loadConfig(): DaemonConfig {
  const identity = loadIdentity();
  return {
    port: 10086,
    identity,
  };
}

export function writePid(pid: number): void {
  ensureDir(CONFIG_DIR);
  writeFileSync(PID_FILE, String(pid));
}

export function readPid(): number | null {
  try {
    return parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
  } catch {
    return null;
  }
}

export function removePid(): void {
  try {
    if (existsSync(PID_FILE)) {
      const pid = readPid();
      if (pid) {
        try { process.kill(pid, 0); } catch { /* not running, safe to remove */ }
      }
    }
  } catch {}
}

export function getPidFile(): string {
  return PID_FILE;
}

export function getLogDir(): string {
  ensureDir(LOG_DIR);
  return LOG_DIR;
}

export function getLogFile(): string {
  ensureDir(LOG_DIR);
  return LOG_FILE;
}

export function writeLog(message: string): void {
  ensureDir(LOG_DIR);
  const timestamp = new Date().toISOString();
  appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

export { CONFIG_DIR };
