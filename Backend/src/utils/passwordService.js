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
}

module.exports = new PasswordService();
