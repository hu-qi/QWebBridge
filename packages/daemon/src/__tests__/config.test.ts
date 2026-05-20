import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const testDir = join(homedir(), ".qweb-bridge-test");

describe("Config", () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("generateDeviceId should return a non-empty string", async () => {
    const { generateDeviceId } = await import("../config.js");
    const id = generateDeviceId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("generateDeviceId should produce unique values", async () => {
    const { generateDeviceId } = await import("../config.js");
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).not.toBe(id2);
  });

  it("should use correct config directory", async () => {
    const { CONFIG_DIR } = await import("../config.js");
    expect(CONFIG_DIR).toContain(".qweb-bridge");
  });
});
