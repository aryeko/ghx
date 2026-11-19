import { resolve } from "node:path"
import { defineConfig } from "tsup"
import pkg from "./package.json" with { type: "json" }

const sharedEsbuildOptions = {
  alias: { "@core": resolve(import.meta.dirname, "src") },
  define: { __GHX_VERSION__: JSON.stringify(pkg.version) },
}

export default defineConfig([
  // Library build — keep deps external for package consumers
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    dts: true,
    sourcemap: true,
    onSuccess: "node scripts/copy-registry-cards.mjs",
    esbuildOptions(options) {
      options.alias = sharedEsbuildOptions.alias
      options.define = sharedEsbuildOptions.define
    },
  },
  // CLI build — bundle all deps so the binary is self-contained (no node_modules needed)
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    outDir: "dist",
    clean: false,
    dts: false,
    sourcemap: true,
    noExternal: [/.*/],
    esbuildOptions(options) {
      options.alias = sharedEsbuildOptions.alias
      options.define = sharedEsbuildOptions.define
    },
  },
])
