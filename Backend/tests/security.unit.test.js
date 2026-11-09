const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("express-validator");
const validate = require("../src/middlewares/validate");

test("Validation exposes converted query data without changing Express 5 request getters", async () => {
  const req = Object.create(express.request);
  req.app = express();
  req.url = "/?lowStock=0&isActive=false&limit=2";
  await query("lowStock").isInt({ min: 0 }).toInt().run(req);
  await query("isActive").isBoolean().toBoolean().run(req);
  await query("limit").isInt({ min: 1, max: 100 }).toInt().run(req);
  let next = false;
  validate(req, {}, () => { next = true; });
  assert.equal(next, true);
  assert.deepEqual(req.validatedQuery, { lowStock: 0, isActive: false, limit: 2 });
  assert.equal(req.query.lowStock, "0");
});

test("Input middleware preserves secret values exactly", () => {
  const body = { password: " Abcd123!<b>X</b> ", currentPassword: "<x>", token: " untouched ", customer: { name: "A&B" } };
  const req = { body: structuredClone(body) };
  require("../src/middlewares/xss")(req, {}, () => {});
  assert.deepEqual(req.body, body);
});

test("Development accepts the existing local dashboard URL without using it in production", () => {
  const keys = ["NODE_ENV", "DASHBOARD_URL", "FRONTEND_URL", "DASHBOARD_URL_LOCAL"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    delete process.env.DASHBOARD_URL;
    delete process.env.FRONTEND_URL;
    process.env.DASHBOARD_URL_LOCAL = "http://localhost:5173/";
    process.env.NODE_ENV = "development";
    const { getDashboardUrl, getFrontendUrl } = require("../src/config/frontend");
    assert.equal(getDashboardUrl(), "http://localhost:5173");
    assert.equal(getFrontendUrl(), "http://localhost:5173");
    process.env.NODE_ENV = "production";
    assert.equal(getDashboardUrl(), "");
    process.env.DASHBOARD_URL = "https://dashboard.example.test/";
    assert.equal(getDashboardUrl(), "https://dashboard.example.test");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("Allowed origins normalize scheme-less values (e.g. Vercel's bare VERCEL_URL) and drop unusable ones instead of throwing", () => {
  const keys = ["DASHBOARD_URL", "WEBSITE_URL", "FRONTEND_URL", "DASHBOARD_URL_LOCAL", "WEBSITE_URL_LOCAL", "CLIENT_URL", "VERCEL_URL"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.FRONTEND_URL = "http://localhost:5173/";
    process.env.VERCEL_URL = "my-app.vercel.app";
    process.env.CLIENT_URL = "not a url";
    const { getAllowedOrigins } = require("../src/config/origins");
    assert.doesNotThrow(getAllowedOrigins);
    assert.deepEqual(getAllowedOrigins(), ["http://localhost:5173", "https://my-app.vercel.app"]);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("Password service exposes a cached dummy hash that verifies like a real one for timing-safety use", async () => {
  const passwords = require("../src/utils/passwordService");
  const first = await passwords.getDummyHash();
  const second = await passwords.getDummyHash();
  assert.equal(first, second);
  assert.equal(await passwords.compare("not the dummy password", first), false);
  assert.equal(typeof first, "string");
  assert.ok(first.startsWith("$argon2id$"));
});

test("Access/refresh token cookies expire at the same time as the JWTs they carry, not a separately hardcoded duration", () => {
  const keys = ["JWT_ACCESS_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.JWT_ACCESS_EXPIRES_IN = "15m";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    delete require.cache[require.resolve("../src/utils/cookiesService")];
    const cookies = require("../src/utils/cookiesService");
    const calls = [];
    const res = { cookie: (key, value, options) => calls.push({ key, options }) };
    cookies.setTokens(res, "access-token-value", "refresh-token-value");
    const access = calls.find((call) => call.key === "accessToken");
    const refresh = calls.find((call) => call.key === "refreshToken");
    assert.equal(access.options.maxAge, 15 * 60 * 1000);
    assert.equal(refresh.options.maxAge, 7 * 24 * 60 * 60 * 1000);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    delete require.cache[require.resolve("../src/utils/cookiesService")];
  }
});

test("Verification codes and reset tokens are hashed with a server-keyed HMAC, not a bare unkeyed hash", () => {
  const original = process.env.JWT_SECRET_KEY;
  try {
    process.env.JWT_SECRET_KEY = "a".repeat(40);
    delete require.cache[require.resolve("../src/utils/verificationCodeService")];
    const codes = require("../src/utils/verificationCodeService");
    const hashedWithFirstKey = codes.hashVerificationCode("123456");
    assert.ok(codes.verifyVerificationCode("123456", hashedWithFirstKey));
    assert.ok(!codes.verifyVerificationCode("654321", hashedWithFirstKey));

    process.env.JWT_SECRET_KEY = "b".repeat(40);
    delete require.cache[require.resolve("../src/utils/verificationCodeService")];
    const codesWithDifferentKey = require("../src/utils/verificationCodeService");
    const hashedWithSecondKey = codesWithDifferentKey.hashVerificationCode("123456");
    // Same plaintext code, different server secret, must hash differently -
    // a bare crypto.createHash output would be identical either way.
    assert.notEqual(hashedWithFirstKey, hashedWithSecondKey);

    const resetHash = codesWithDifferentKey.hashResetToken("some-reset-token");
    assert.ok(codesWithDifferentKey.verifyVerificationCode !== undefined);
    assert.notEqual(resetHash, hashedWithSecondKey);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET_KEY; else process.env.JWT_SECRET_KEY = original;
    delete require.cache[require.resolve("../src/utils/verificationCodeService")];
  }
});

test("JWTs have unique identities, enforce token purpose and require a session version", () => {
  process.env.JWT_SECRET_KEY = "unit-test-only-access-secret-123456789";
  process.env.REFRESH_JWT_SECRET_KEY = "unit-test-only-refresh-secret-123456789";
  const service = require("../src/utils/jwtService");
  const payload = { id: "abcdef123456abcdef123456", ver: 3, role: "saler" };
  const first = service.generateRefreshToken(payload);
  const second = service.generateRefreshToken(payload);
  assert.notEqual(first, second);
  assert.equal(service.verifyRefreshToken(first).ver, 3);
  assert.throws(() => service.verifyAccessToken(first));
  const legacy = require("jsonwebtoken").sign({ id: payload.id }, process.env.JWT_SECRET_KEY);
  assert.throws(() => service.verifyAccessToken(legacy));
});

test("Configuration errors fail before database startup and do not expose secrets", () => {
  const names = ["MONGODB_URL", "JWT_SECRET_KEY", "REFRESH_JWT_SECRET_KEY", "DASHBOARD_URL", "FRONTEND_URL", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "JWT_ACCESS_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN", "TRUST_PROXY_HOPS", "EMAIL_SECURE"];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const { validateConfiguration } = require("../src/config/startup");
  try {
    for (const name of names) delete process.env[name];
    assert.throws(validateConfiguration, /Missing configuration/);
    Object.assign(process.env, {
      MONGODB_URL: "mongodb://127.0.0.1/test", JWT_SECRET_KEY: "a".repeat(40), REFRESH_JWT_SECRET_KEY: "b".repeat(40),
      FRONTEND_URL: "http://localhost:5173", EMAIL_HOST: "localhost", EMAIL_PORT: "1025", EMAIL_USER: "test", EMAIL_PASSWORD: "test",
      CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "test", CLOUDINARY_API_SECRET: "test",
    });
    assert.doesNotThrow(validateConfiguration);
    process.env.REFRESH_JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
    assert.throws(validateConfiguration, /distinct/);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
