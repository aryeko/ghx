import { resolve } from "node:path"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@agent-profiler": resolve(import.meta.dirname, "src"),
    }
  },
})
