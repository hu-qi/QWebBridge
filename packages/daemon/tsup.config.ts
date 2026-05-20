import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  platform: "node",
});
