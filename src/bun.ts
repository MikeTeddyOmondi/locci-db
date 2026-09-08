/**
 * Bun entry point for the compiled single-file binary.
 *
 * PGlite resolves postgres.wasm and postgres.data relative to its own module
 * URL at runtime, which no longer exists once everything is compiled into one
 * executable. Both files are embedded here instead and handed to PGlite
 * explicitly, which it supports via its wasmModule and fsBundle options.
 *
 * The paths reach into node_modules directly because the package does not
 * export these assets. Bun resolves them at bundle time, not at runtime.
 */
import wasmPath from "../node_modules/@electric-sql/pglite/dist/postgres.wasm" with { type: "file" };
import dataPath from "../node_modules/@electric-sql/pglite/dist/postgres.data" with { type: "file" };
import { setEmbeddedPGliteAssets } from "./pglite-assets.js";

setEmbeddedPGliteAssets({
  wasmModule: await WebAssembly.compile(await Bun.file(wasmPath).arrayBuffer()),
  fsBundle: new Blob([await Bun.file(dataPath).arrayBuffer()]),
});

await import("./cli.js");
