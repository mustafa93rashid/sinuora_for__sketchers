const User = require("../models/user.model");
const jwt = require("../utils/jwtService");
const passwords = require("../utils/passwordService");
const cookies = require("../utils/cookiesService");
const codes = require("../utils/verificationCodeService");
const email = require("../services/email.service");
const { getFrontendUrl } = require("../config/frontend");
const { hashToken, versionFilter, tokensFor, disconnectUser, sensitiveUnset } = require("../helpers/session.helper");
const loginAnomaly = require("../helpers/loginAnomaly.helper");
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const active = { isActive: true, isAccountActivated: true, deletedAt: null };
const publicFields = "_id fullName email phone role avatar isAccountActivated isActive lastLoginAt createdBy createdAt updatedAt";

class AuthController {
  login = async (req, res) => {
    const { email, password } = req.body;
    const delay = loginAnomaly.reserveDelay(email);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const found = await User.findOne({ email, deletedAt: null }).select("+password");
    // Always run a real Argon2 verify, even for a nonexistent account,
    // so response time doesn't leak whether the email is registered.
    const passwordValid = await passwords.compare(password, found ? found.password : await passwords.getDummyHash());
    if (!found || !passwordValid) {
      loginAnomaly.recordFailedLogin(email);
      fail("Invalid email or password");
    }
    loginAnomaly.clearFailedLogins(email);
    if (!found.isActive || !found.isAccountActivated) fail("Account is not active", 403);
    // A successful login replaces the single existing session atomically.
    const user = await User.findOneAndUpdate(
      { _id: found._id, password: found.password, ...active },
      { $inc: { tokenVersion: 1 }, $unset: { refreshToken: 1 }, $set: { lastLoginAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!user) fail("Account changed; sign in again", 409);
    disconnectUser(user._id);
    const tokens = tokensFor(user);
    const saved = await User.updateOne(
      { _id: user._id, tokenVersion: user.tokenVersion, ...active },
      { $set: { refreshToken: hashToken(tokens.refreshToken) } },
    );
    if (!saved.matchedCount) fail("Session changed; sign in again", 409);
    cookies.setTokens(res, tokens.accessToken, tokens.refreshToken);
    const profile = await User.findById(user._id).select(publicFields);
    return res.json({ success: true, message: "User logged in successfully", data: profile });
  };

  logout = async (req, res) => {
    await User.updateOne({ _id: req.user._id, ...versionFilter(req.user.tokenVersion ?? 0) }, {
      $inc: { tokenVersion: 1 }, $unset: { refreshToken: 1 },
    });
    disconnectUser(req.user._id);
    cookies.clearTokens(res);
    return res.json({ success: true, message: "User logged out successfully" });
  };

  getCurrentUser = async (req, res) => {
    const user = await User.findOne({ _id: req.user._id, deletedAt: null }).select(publicFields).populate("createdBy", "fullName email role");
    if (!user) fail("User not found", 404);
    return res.json({ success: true, data: user });
  };

  requestPasswordChange = async (req, res) => {
    const user = await User.findOne({ _id: req.user._id, ...active }).select("+password");
    if (!user || !await passwords.compare(req.body.currentPassword, user.password)) fail("Current password is incorrect");
    const code = codes.generateVerificationCode();
    const hash = codes.hashVerificationCode(code);
    const result = await User.updateOne({ _id: user._id, password: user.password, ...active, ...versionFilter(req.user.tokenVersion ?? 0) }, {
      $set: { passwordChangeCode: hash, passwordChangeCodeExpires: new Date(Date.now() + 600000), passwordChangeAttempts: 0 },
    });
    if (!result.matchedCount) fail("Session changed; sign in again", 401);
    try {
      await email.sendPasswordChangeVerificationEmail({ to: user.email, fullName: user.fullName, verificationCode: code });
    } catch (error) {
      await User.updateOne({ _id: user._id, passwordChangeCode: hash }, { $unset: { passwordChangeCode: 1, passwordChangeCodeExpires: 1, passwordChangeAttempts: 1 } });
      throw error;
    }
    return res.json({ success: true, message: "Verification code sent successfully" });
  };

  verifyPasswordChange = async (req, res) => {
    const user = await User.findOneAndUpdate({
      _id: req.user._id, ...active, ...versionFilter(req.user.tokenVersion ?? 0),
      passwordChangeCodeExpires: { $gt: new Date() }, passwordChangeAttempts: { $lt: 5 },
    }, { $inc: { passwordChangeAttempts: 1 } }, { returnDocument: "after" }).select("+password +passwordChangeCode");
    if (!user || !user.passwordChangeCode || !codes.verifyVerificationCode(req.body.verificationCode, user.passwordChangeCode)) fail("Invalid, expired or exhausted verification code");
    if (await passwords.compare(req.body.newPassword, user.password)) fail("New password must be different");
    const password = await passwords.hash(req.body.newPassword);
    const result = await User.updateOne({
      _id: user._id, ...active, ...versionFilter(user.tokenVersion ?? 0), password: user.password,
      passwordChangeCode: user.passwordChangeCode, passwordChangeCodeExpires: { $gt: new Date() },
    }, { $set: { password }, $inc: { tokenVersion: 1 }, $unset: sensitiveUnset });
    if (!result.matchedCount) fail("Verification code was consumed or expired", 409);
    disconnectUser(user._id);
    cookies.clearTokens(res);
    return res.json({ success: true, message: "Password changed. Please sign in again." });
  };

  forgotPassword = async (req, res) => {
    const message = "If an account exists for this email address, you will receive password reset instructions shortly.";
    const token = codes.generateResetToken();
    const hash = codes.hashResetToken(token);
    const user = await User.findOneAndUpdate({ email: req.body.email, ...active }, {
      $set: { passwordResetToken: hash, passwordResetExpires: new Date(Date.now() + 900000) },
    }, { returnDocument: "after" });
    if (user) {
      try {
        await email.sendPasswordResetEmail({ to: user.email, fullName: user.fullName, resetUrl: `${getFrontendUrl()}/reset-password/${token}` });
      } catch (error) {
        await User.updateOne({ _id: user._id, passwordResetToken: hash }, { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } });
        console.error("Password reset email failed:", error.message);
      }
    }
    return res.json({ success: true, message });
  };

  resetPassword = async (req, res) => {
    const hash = codes.hashResetToken(req.params.token);
    const user = await User.findOne({ ...active, passwordResetToken: hash, passwordResetExpires: { $gt: new Date() } }).select("+password");
    if (!user) fail("Invalid or expired password reset token");
    if (await passwords.compare(req.body.newPassword, user.password)) fail("New password must be different");
    const password = await passwords.hash(req.body.newPassword);
    const result = await User.updateOne({
      _id: user._id, ...active, passwordResetToken: hash, passwordResetExpires: { $gt: new Date() },
      ...versionFilter(user.tokenVersion ?? 0),
    }, { $set: { password }, $inc: { tokenVersion: 1 }, $unset: sensitiveUnset });
    if (!result.matchedCount) fail("Password reset token was consumed or expired", 409);
    disconnectUser(user._id);
    cookies.clearTokens(res);
    return res.json({ success: true, message: "Password reset. Please sign in again." });
  };

  refreshToken = async (req, res) => {
    const token = cookies.getRefreshToken(req);
    let decoded;
    try { decoded = jwt.verifyRefreshToken(token); }
    catch { cookies.clearTokens(res); fail("Invalid or expired refresh token", 401); }
    const user = await User.findOne({ _id: decoded.id, ...active, ...versionFilter(decoded.ver), refreshToken: hashToken(token) });
    if (!user) fail("Refresh session is no longer valid", 401);
    const tokens = tokensFor(user);
    const result = await User.updateOne({
      _id: user._id, ...active, ...versionFilter(decoded.ver), refreshToken: hashToken(token),
    }, { $set: { refreshToken: hashToken(tokens.refreshToken) } });
    // A losing concurrent request must not clear or revoke the winning session.
    if (!result.matchedCount) fail("Refresh token already consumed; use the latest session", 401);
    cookies.setTokens(res, tokens.accessToken, tokens.refreshToken);
    return res.json({ success: true, message: "Token refreshed successfully" });
  };
}
module.exports = new AuthController();
