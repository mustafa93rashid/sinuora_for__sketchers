const crypto = require("crypto");

// ==================== Constants ====================

const VERIFICATION_CODE_LENGTH = 6;

const RESET_TOKEN_SIZE = 32;

const HASH_ALGORITHM = "sha256";

// ==================== Hash Value ====================
// Verification codes only have 900,000 possible values; a bare,
// unkeyed hash lets anyone who dumps the users collection precompute
// every hash and recover a pending code instantly (audit finding
// L-3). HMAC the value under the server's JWT secret instead, so the
// stored hash is unusable without that secret even if the database
// is exfiltrated. Distinct contexts keep verification-code and
// reset-token hashes from ever landing in the same hash space.

const deriveKey = (context) => {
  const secret = process.env.JWT_SECRET_KEY;

  if (!secret) {
    throw new Error("JWT_SECRET_KEY is required to hash verification values");
  }

  return crypto.createHmac(HASH_ALGORITHM, secret).update(context).digest();
};

const hashValue = (value, context) => {
  return crypto
    .createHmac(HASH_ALGORITHM, deriveKey(context))
    .update(value.toString())
    .digest("hex");
};

// ==================== Generate Verification Code ====================

const generateVerificationCode = () => {
  const min = 10 ** (VERIFICATION_CODE_LENGTH - 1);

  const max = 10 ** VERIFICATION_CODE_LENGTH;

  return crypto.randomInt(min, max).toString();
};

// ==================== Hash Verification Code ====================

const hashVerificationCode = (code) => {
  return hashValue(code, "verification-code");
};

// ==================== Verify Verification Code ====================

const verifyVerificationCode = (plainCode, hashedCode) => {
  const plainHash = hashVerificationCode(plainCode);

  const plainBuffer = Buffer.from(plainHash, "hex");

  const hashedBuffer = Buffer.from(hashedCode, "hex");

  if (plainBuffer.length !== hashedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(plainBuffer, hashedBuffer);
};

// ==================== Generate Reset Token ====================

const generateResetToken = () => {
  return crypto.randomBytes(RESET_TOKEN_SIZE).toString("hex");
};

// ==================== Hash Reset Token ====================

const hashResetToken = (token) => {
  return hashValue(token, "reset-token");
};

module.exports = {
  generateVerificationCode,
  hashVerificationCode,
  verifyVerificationCode,
  generateResetToken,
  hashResetToken,
};
