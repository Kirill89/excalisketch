import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The npx shim executes bin/cli.js directly, so it must be executable — if the
// committed mode drops to 644, `npx excalisketch` fails with "Permission denied".
test("bin/cli.js is executable", () => {
  const cli = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "bin",
    "cli.js",
  );
  const mode = statSync(cli).mode;
  assert.ok(
    mode & 0o111,
    `bin/cli.js not executable (mode ${(mode & 0o777).toString(8)})`,
  );
});
