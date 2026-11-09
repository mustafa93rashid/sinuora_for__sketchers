const argon2 = require("argon2");

// ==================== Argon2 Configuration ====================

const ARGON2_OPTIONS = {
  type: argon2.argon2id,

  memoryCost: 2 ** 16,

  timeCost: 3,

  parallelism: 1,

  hashLength: 32,
};

// ==================== Password Service ====================

class PasswordService {
  // ==================== Hash Password ====================

  hash = async (password) => {
    try {
      return await argon2.hash(password, ARGON2_OPTIONS);
    } catch (error) {
      throw new Error("Failed to hash password");
    }
  };

  // ==================== Verify Password ====================

  compare = async (password, hashedPassword) => {
    try {
      return await argon2.verify(hashedPassword, password);
    } catch (error) {
      throw new Error("Failed to verify password");
    }
  };

  // ==================== Timing-Safe Dummy Hash ====================
  // A real Argon2id hash with no corresponding account, so a lookup
  // for a nonexistent email can still run a verify of comparable cost
  // instead of returning near-instantly - closing the timing side
  // channel that would otherwise let an attacker distinguish "wrong
  // password" from "no such account" by response time.

  getDummyHash = () => {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.hash("timing-safety-dummy-password");
    }

    return this.dummyHashPromise;
  };
}

module.exports = new PasswordService();
