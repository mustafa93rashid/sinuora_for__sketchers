const { existsSync, readdirSync } = require("node:fs");
const path = require("node:path");

const WINDOWS_SERVER_ROOT = "C:\\Program Files\\MongoDB\\Server";

const POSIX_CANDIDATES = [
  "/usr/bin/mongod",
  "/usr/local/bin/mongod",
  "/opt/homebrew/bin/mongod",
  "/usr/local/opt/mongodb-community/bin/mongod",
];

// Resolves a mongod binary to run the Backend/tests/orders.integration.test.js
// replica set against: an explicit MONGOD_BINARY first, then a best-effort
// local install, so `npm run test:integration` works out of the box on a dev
// machine that already has MongoDB installed, without requiring the env var
// to be set by hand every session (audit finding H-3).
const resolveMongodBinary = ({
  env = process.env,
  platform = process.platform,
  exists = existsSync,
  listVersions = (root) => {
    try {
      return readdirSync(root);
    } catch {
      return [];
    }
  },
} = {}) => {
  if (env.MONGOD_BINARY && exists(env.MONGOD_BINARY)) {
    return env.MONGOD_BINARY;
  }

  if (platform === "win32") {
    const versions = [...listVersions(WINDOWS_SERVER_ROOT)].sort().reverse();

    // path.win32.join (not the plain, host-dependent path.join) so this
    // always builds a backslash-separated Windows path, even when the
    // `platform` option simulates win32 on a POSIX test runner/CI host.
    for (const version of versions) {
      const candidate = path.win32.join(WINDOWS_SERVER_ROOT, version, "bin", "mongod.exe");

      if (exists(candidate)) return candidate;
    }

    return null;
  }

  for (const candidate of POSIX_CANDIDATES) {
    if (exists(candidate)) return candidate;
  }

  return null;
};

module.exports = { resolveMongodBinary };
