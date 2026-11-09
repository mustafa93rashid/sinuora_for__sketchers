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

test("Eviction protects an account already over the anomaly threshold from being pushed out by a flood of fresh junk keys", () => {
  const target = "protected@example.test";
  const now = Date.now();
  for (let i = 0; i < 10; i++) loginAnomaly.recordFailedLogin(target, now);
  assert.ok(loginAnomaly.getDelayMs(target, now) > 0);
  for (let i = 0; i < 6000; i++) loginAnomaly.recordFailedLogin(`flood2-${i}@example.test`, now + 1);
  assert.ok(loginAnomaly.getDelayMs(target, now + 1) > 0, "the already-anomalous account must still be tracked and delayed after the flood");
  loginAnomaly.clearFailedLogins(target);
});

test("reserveDelay serializes concurrent requests for the same account so they queue instead of all reading the same stale delay", () => {
  const email = "burst@example.test";
  const now = Date.now();
  for (let i = 0; i < 10; i++) loginAnomaly.recordFailedLogin(email, now);
  const first = loginAnomaly.reserveDelay(email, now);
  const second = loginAnomaly.reserveDelay(email, now);
  const third = loginAnomaly.reserveDelay(email, now);
  assert.ok(first > 0, "expected a delay once the threshold is crossed");
  assert.ok(second > first, "a second concurrent request must queue behind the first, not read the same delay");
  assert.ok(third > second, "a third concurrent request must queue behind the first two");
  assert.ok(third <= 3000, "the queued wait must still respect the overall cap");
  loginAnomaly.clearFailedLogins(email);
  assert.equal(loginAnomaly.reserveDelay(email, now), 0, "a cleared account must not be delayed");
});

test("claimAttempt counts the attempt itself before computing its delay, so simultaneous attempts stack instead of all reading a stale pre-attempt count", () => {
  const email = "simultaneous@example.test";
  const now = Date.now();
  for (let i = 0; i < 9; i++) loginAnomaly.recordFailedLogin(email, now); // one below the threshold
  // Three "simultaneous" attempts, modeled as back-to-back synchronous
  // calls with the same `now` - exactly what three concurrent requests
  // produce in Node, since each one's synchronous code runs to
  // completion before any of their awaited work resolves.
  const first = loginAnomaly.claimAttempt(email, now);
  const second = loginAnomaly.claimAttempt(email, now);
  const third = loginAnomaly.claimAttempt(email, now);
  assert.ok(first > 0, "the 10th attempt (9 prior + this one) must already be delayed, not wait for a confirmed failure first");
  assert.ok(second > first, "the 11th attempt must be delayed more than the 10th");
  assert.ok(third > second, "the 12th attempt must be delayed more than the 11th");
  loginAnomaly.clearFailedLogins(email);
});
