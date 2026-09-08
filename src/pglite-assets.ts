import type { PGliteOptions } from "@electric-sql/pglite";

/**
 * PGlite normally fetches postgres.wasm and postgres.data from disk, relative
 * to its own module URL. That does not work inside a compiled single-file
 * binary, so the Bun entry point embeds both and injects them here before the
 * server starts.
 */
// Derived from PGlite's own options so this file does not need the DOM lib
// just to name WebAssembly.Module and Blob.
export type EmbeddedPGliteAssets = Pick<
  PGliteOptions,
  "wasmModule" | "fsBundle"
>;

let embedded: EmbeddedPGliteAssets = {};

export function setEmbeddedPGliteAssets(assets: EmbeddedPGliteAssets): void {
  embedded = assets;
}

export function getEmbeddedPGliteAssets(): EmbeddedPGliteAssets {
  return embedded;
}
