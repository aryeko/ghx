import { resolve } from "node:path"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  // tsup currently synthesizes baseUrl for declaration bundling; its TS6 API
  // needs the localized deprecation allowance while tsc itself runs TS7.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@profiler": resolve(import.meta.dirname, "src"),
    }
  },
})
