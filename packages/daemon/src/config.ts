import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomBytes } from "crypto";
import type { DeviceIdentity } from "@qweb/protocol";

const CONFIG_DIR = join(homedir(), ".qweb-bridge");
const IDENTITY_FILE = join(CONFIG_DIR, "identity.json");
const PID_FILE = join(CONFIG_DIR, "daemon.pid");
const LOG_DIR = join(CONFIG_DIR, "logs");

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

export function getPidFile(): string {
  return PID_FILE;
}

export function getLogDir(): string {
  ensureDir(LOG_DIR);
  return LOG_DIR;
}

export { CONFIG_DIR };
