const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET_KEY = "unit-test-only-secret-not-for-deployment";

const {
  generateVerificationCode,
  hashVerificationCode,
  verifyVerificationCode,
  generateResetToken,
  hashResetToken,
} = require("../src/utils/verificationCodeService");

// ==================== generateVerificationCode ====================

test("generateVerificationCode always produces a 6-digit numeric string", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateVerificationCode();
    assert.match(code, /^\d{6}$/);
    const value = Number(code);
    assert.ok(value >= 100000 && value <= 999999);
  }
});

// ==================== hashVerificationCode / hashResetToken ====================

test("hashVerificationCode is deterministic for the same code", () => {
  assert.equal(hashVerificationCode("123456"), hashVerificationCode("123456"));
});

test("hashVerificationCode produces different hashes for different codes", () => {
  assert.notEqual(hashVerificationCode("123456"), hashVerificationCode("654321"));
});

test("hashVerificationCode and hashResetToken hash the same raw value into different hashes", () => {
  // Audit finding L-3: distinct HMAC contexts keep verification-code and
  // reset-token hashes from landing in the same hash space, so a leaked
  // reset-token hash can't be replayed as a verification-code hash.
  const raw = "shared-raw-value";
  assert.notEqual(hashVerificationCode(raw), hashResetToken(raw));
});

test("hashVerificationCode requires JWT_SECRET_KEY to be configured", () => {
  const original = process.env.JWT_SECRET_KEY;
  delete process.env.JWT_SECRET_KEY;
  try {
    assert.throws(
      () => hashVerificationCode("123456"),
      /JWT_SECRET_KEY is required/,
    );
  } finally {
    process.env.JWT_SECRET_KEY = original;
  }
});

// ==================== verifyVerificationCode ====================

test("verifyVerificationCode accepts the matching plain code for a given hash", () => {
  const hashed = hashVerificationCode("482913");
  assert.equal(verifyVerificationCode("482913", hashed), true);
});

test("verifyVerificationCode rejects a non-matching plain code", () => {
  const hashed = hashVerificationCode("482913");
  assert.equal(verifyVerificationCode("000000", hashed), false);
});

test("verifyVerificationCode rejects a malformed stored hash without throwing", () => {
  assert.equal(verifyVerificationCode("482913", "not-a-valid-hex-hash"), false);
});

// ==================== generateResetToken ====================

test("generateResetToken produces a 64-character hex string (32 bytes)", () => {
  const token = generateResetToken();
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("generateResetToken produces unpredictable, non-repeating tokens", () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a, b);
});
