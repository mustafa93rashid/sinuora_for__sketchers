const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveMongodBinary } = require("../scripts/resolve-mongod");

test("Resolves a mongod binary from the environment first, then a local Windows install by highest version, otherwise null", () => {
  assert.equal(
    resolveMongodBinary({ env: { MONGOD_BINARY: "/custom/mongod" }, exists: (p) => p === "/custom/mongod" }),
    "/custom/mongod"
  );

  assert.equal(
    resolveMongodBinary({
      env: { MONGOD_BINARY: "/missing/mongod" },
      platform: "win32",
      exists: (p) => p === "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe",
      listVersions: () => ["6.0", "8.2", "7.0"],
    }),
    "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe"
  );

  assert.equal(resolveMongodBinary({ env: {}, platform: "linux", exists: () => false }), null);
  assert.equal(
    resolveMongodBinary({ env: {}, platform: "linux", exists: (p) => p === "/usr/bin/mongod" }),
    "/usr/bin/mongod"
  );
});
