const crypto = require("crypto");

// ==================== Constants ====================

const VERIFICATION_CODE_LENGTH = 6;

const RESET_TOKEN_SIZE = 32;

const HASH_ALGORITHM = "sha256";

// ==================== Hash Value ====================

const hashValue = (value) => {
  return crypto
    .createHash(HASH_ALGORITHM)
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
  return hashValue(code);
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
  return hashValue(token);
};

module.exports = {
  generateVerificationCode,
  hashVerificationCode,
  verifyVerificationCode,
  generateResetToken,
  hashResetToken,
};
