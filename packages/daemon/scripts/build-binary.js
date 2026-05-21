#!/usr/bin/env node
/**
 * Build standalone binary for qweb-bridge daemon.
 *
 * Uses esbuild to bundle the CLI into a single CJS file, then
 * compiles it with @yao-pkg/pkg into a standalone executable.
 *
 * Output: packages/daemon/dist-sea/qweb-bridge
 *
 * Prerequisites: npm install -g @yao-pkg/pkg
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST_SEA = resolve(ROOT, "dist-sea");
const CLI_SRC = resolve(ROOT, "src/cli/cli.ts");
const CLI_CJS = resolve(DIST_SEA, "cli.cjs");
const OUTPUT = resolve(DIST_SEA, "qweb-bridge");
const PLATFORM = `${process.platform}-${process.arch}`.replace("darwin", "macos");

// Step 1: Bundle with esbuild
console.log("[build:binary] Bundling with esbuild...");
if (!existsSync(DIST_SEA)) mkdirSync(DIST_SEA, { recursive: true });
execSync(`npx esbuild ${CLI_SRC} --bundle --platform=node --target=node22 --format=cjs --outfile=${CLI_CJS}`, {
  stdio: "inherit",
  cwd: ROOT,
});

// Step 2: Compile with pkg
console.log("[build:binary] Compiling with pkg...");
execSync(`pkg ${CLI_CJS} --targets node22-${PLATFORM} --output ${OUTPUT}`, {
  stdio: "inherit",
  cwd: ROOT,
});

console.log(`[build:binary] Done: ${OUTPUT}`);
