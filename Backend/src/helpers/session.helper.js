const crypto = require("node:crypto");
const jwt = require("../utils/jwtService");
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");
const versionFilter = version => version === 0
  ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
  : { tokenVersion: version };
const tokensFor = user => {
  const payload = { id: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 };
  return { accessToken: jwt.generateAccessToken(payload), refreshToken: jwt.generateRefreshToken(payload) };
};
const disconnectUser = id => require("../config/socket").disconnectUser(id);
const sensitiveUnset = {
  refreshToken: 1, passwordResetToken: 1, passwordResetExpires: 1,
  passwordChangeCode: 1, passwordChangeCodeExpires: 1, passwordChangeAttempts: 1,
  pendingEmail: 1, emailChangeCode: 1, emailChangeCodeExpires: 1, emailChangeAttempts: 1,
};
module.exports = { hashToken, versionFilter, tokensFor, disconnectUser, sensitiveUnset };
