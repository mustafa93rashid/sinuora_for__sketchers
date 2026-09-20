require("dotenv").config();

const jwt = require("jsonwebtoken");

// ==================== JWT Configuration ====================

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET_KEY;

const REFRESH_TOKEN_SECRET = process.env.REFRESH_JWT_SECRET_KEY;

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN;

const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;

// ==================== JWT Service ====================

class JwtService {
  // ==================== Generate Access Token ====================

  generateAccessToken = (payload) => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN});
  };

  // ==================== Generate Refresh Token ====================

  generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN});
  };

  // ==================== Verify Access Token ====================

  verifyAccessToken = (token) => {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  };

  // ==================== Verify Refresh Token ====================

  verifyRefreshToken = (token) => {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  };
}

module.exports = new JwtService();