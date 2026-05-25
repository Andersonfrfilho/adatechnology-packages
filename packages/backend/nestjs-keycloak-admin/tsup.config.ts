import { defineConfig } from "tsup";
import { TsconfigPathsPlugin } from "@esbuild-plugins/tsconfig-paths";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node16",
  tsconfig: "tsconfig.tsup.json",
  dts: false,
  clean: true,
  outDir: "dist",
  external: ["@nestjs/*", "@adatechnology/nestjs-logger"],
  noExternal: ["@adatechnology/shared"],
  esbuildPlugins: [TsconfigPathsPlugin({ tsconfig: "tsconfig.tsup.json" })],
  decoratorMetadata: true,
});
