import { defineConfig } from "tsup";
import { TsconfigPathsPlugin } from "@esbuild-plugins/tsconfig-paths";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node16",
  tsconfig: "tsconfig.tsup.json",
  dts: true,
  clean: true,
  outDir: "dist",
  external: ["@nestjs/*", "@adatechnology/logger", "@adatechnology/cache"],
  // Bundle private `shared` into the published artifact so consumers don't need
  // the unpublished `@adatechnology/shared` package from npm.
  noExternal: ["@adatechnology/shared"],
  esbuildPlugins: [TsconfigPathsPlugin({ tsconfig: "tsconfig.tsup.json" })],
  // Required for NestJS DI: esbuild strips decorator metadata by default,
  // breaking constructor-based injection. This re-enables __metadata emission.
  decoratorMetadata: true,
});
