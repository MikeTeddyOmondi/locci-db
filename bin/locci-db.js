#!/usr/bin/env node

// Shim to load the compiled TypeScript CLI
import('../dist/cli.js').catch((err) => {
  console.error('Failed to start @locci/db:', err);
  process.exit(1);
});
