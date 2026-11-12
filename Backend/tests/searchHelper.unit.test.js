const { test } = require("node:test");
const assert = require("node:assert/strict");
const { escapeRegex, buildSearchFilter } = require("../src/helpers/search.helper");

// ==================== escapeRegex ====================

test("escapeRegex neutralizes every regex metacharacter", () => {
  const metachars = ".*+?^${}()|[]\\";
  const escaped = escapeRegex(metachars);
  // Every metacharacter must come back backslash-prefixed, and the
  // escaped string must be safe to compile as a literal regex.
  const compiled = new RegExp(escaped);
  assert.ok(compiled.test(metachars));
});

test("escapeRegex prevents a wildcard search from matching everything", () => {
  const userInput = ".*";
  const escaped = escapeRegex(userInput);
  const regex = new RegExp(escaped, "i");
  assert.equal(regex.test("anything"), false);
  assert.equal(regex.test(".*"), true);
});

test("escapeRegex leaves plain alphanumeric search terms untouched", () => {
  assert.equal(escapeRegex("SN-1048"), "SN-1048");
});

// ==================== buildSearchFilter ====================

test("buildSearchFilter returns an empty filter when there is no search term", () => {
  assert.deepEqual(buildSearchFilter("", ["name"]), {});
  assert.deepEqual(buildSearchFilter(undefined, ["name"]), {});
});

test("buildSearchFilter builds a case-insensitive $or across every given field", () => {
  const filter = buildSearchFilter("noor", ["customer.name", "customer.phone"]);
  assert.deepEqual(filter, {
    $or: [
      { "customer.name": { $regex: "noor", $options: "i" } },
      { "customer.phone": { $regex: "noor", $options: "i" } },
    ],
  });
});

test("buildSearchFilter escapes regex metacharacters in the search term before building the filter", () => {
  const filter = buildSearchFilter("a(b", ["name"]);
  assert.equal(filter.$or[0].name.$regex, "a\\(b");
});
