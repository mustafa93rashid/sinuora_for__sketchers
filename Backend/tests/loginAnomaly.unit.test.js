const { test } = require("node:test");
const assert = require("node:assert/strict");
const loginAnomaly = require("../src/helpers/loginAnomaly.helper");

test("Login anomaly monitor counts failed attempts per normalized email, resets on success, and never blocks", () => {
  const email = "  User@Example.com  ";
  assert.equal(loginAnomaly.recordFailedLogin(email), 1);
  assert.equal(loginAnomaly.recordFailedLogin("user@example.com"), 2);
  assert.equal(loginAnomaly.recordFailedLogin("USER@EXAMPLE.COM"), 3);
  loginAnomaly.clearFailedLogins(email);
  assert.equal(loginAnomaly.recordFailedLogin(email), 1);
  assert.equal(loginAnomaly.recordFailedLogin(""), 0);
  assert.equal(loginAnomaly.recordFailedLogin(undefined), 0);
});

test("Login anomaly window resets the count after it expires", () => {
  const email = "windowed@example.test";
  const start = Date.now();
  assert.equal(loginAnomaly.recordFailedLogin(email, start), 1);
  assert.equal(loginAnomaly.recordFailedLogin(email, start + 1000), 2);
  assert.equal(loginAnomaly.recordFailedLogin(email, start + 16 * 60 * 1000), 1);
});
