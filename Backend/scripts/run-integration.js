const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
if (!process.env.MONGOD_BINARY || !existsSync(process.env.MONGOD_BINARY)) {
  console.error("Set MONGOD_BINARY to an installed mongod executable. Integration tests must not be skipped in the release check.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", "tests/orders.unit.test.js", "tests/security.unit.test.js", "tests/orders.integration.test.js"], {
    cwd: resolve(__dirname, ".."), stdio: "inherit", windowsHide: true, env: process.env,
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
