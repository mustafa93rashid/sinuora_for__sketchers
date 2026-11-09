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

test("getDelayMs stays zero below the threshold, then grows and caps - never blocking, only slowing", () => {
  const email = "delayed@example.test";
  const start = Date.now();
  for (let i = 1; i < 10; i++) {
    loginAnomaly.recordFailedLogin(email, start);
    assert.equal(loginAnomaly.getDelayMs(email, start), 0, `expected no delay below threshold at attempt ${i}`);
  }
  loginAnomaly.recordFailedLogin(email, start); // 10th failure crosses the threshold
  const firstDelay = loginAnomaly.getDelayMs(email, start);
  assert.ok(firstDelay > 0, "expected a delay once the threshold is crossed");
  for (let i = 0; i < 20; i++) loginAnomaly.recordFailedLogin(email, start);
  assert.ok(loginAnomaly.getDelayMs(email, start) <= 3000, "delay must stay bounded, never grow without limit");
  loginAnomaly.clearFailedLogins(email);
  assert.equal(loginAnomaly.getDelayMs(email, start), 0, "a cleared account must not be delayed");
});

test("Email masking keeps enough context for a log line without exposing the full address", () => {
  assert.equal(loginAnomaly.maskEmail("jane.doe@example.com"), "j***@example.com");
  assert.equal(loginAnomaly.maskEmail("a@example.com"), "a***@example.com");
  assert.equal(loginAnomaly.maskEmail("not-an-email"), "***");
});

test("The failure-count store is bounded in size so an attacker probing many fake emails cannot grow it without limit", () => {
  const now = Date.now();
  for (let i = 0; i < 6000; i++) loginAnomaly.recordFailedLogin(`flood-${i}@example.test`, now);
  assert.ok(loginAnomaly.size() <= 5000, `expected the store to stay bounded, was ${loginAnomaly.size()}`);
});
