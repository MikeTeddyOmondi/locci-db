// Prints the CHANGELOG.md section for one version, for use as a GitHub release
// body. Exits non-zero when the version has no section, so a release cannot
// quietly ship with empty notes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("usage: extract-changelog.mjs <version>");
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(join(root, "CHANGELOG.md"), "utf-8").split("\n");

// Matches "## [1.2.3] - date" and "## 1.2.3".
const heading = (line) =>
  /^##\s+\[?([^\]\s]+)\]?/.exec(line)?.[1]?.replace(/^v/, "");

const start = lines.findIndex((l) => heading(l) === version.replace(/^v/, ""));
if (start === -1) {
  console.error(`no CHANGELOG.md section for version ${version}`);
  process.exit(1);
}

const rest = lines.slice(start + 1);
const end = rest.findIndex((l) => heading(l) !== undefined);
const body = (end === -1 ? rest : rest.slice(0, end))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

if (!body) {
  console.error(`CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}

console.log(body);
