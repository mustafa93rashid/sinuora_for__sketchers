const crypto = require("crypto");

const User = require("../models/user.model");

const jwtService = require("../utils/jwtService");
const passwordService = require("../utils/passwordService");
const cookiesService = require("../utils/cookiesService");
const verificationCodeService = require("../utils/verificationCodeService");

const emailService = require("../services/email.service");

// ==================== Hash Refresh Token ====================

const hashRefreshToken = (refreshToken) => {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
};

// ==================== Compare Refresh Tokens ====================

const compareRefreshTokens = (providedTokenHash, storedTokenHash) => {
  if (!providedTokenHash || !storedTokenHash) {
    return false;
  }

  const providedBuffer = Buffer.from(providedTokenHash, "hex");

  const storedBuffer = Buffer.from(storedTokenHash, "hex");

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
};

// ==================== Auth Controller ====================

class AuthController {

  // ==================== Login ====================

  login = async (req, res) => {
    const { email, password } = req.body;

    // Find user by email and include password and refreshToken fields
    let user = await User.findOne({
      email: email,
    }).select("+password +refreshToken");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if the provided password matches the stored hashed password
    const isPasswordCorrect = await passwordService.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isAccountActivated) {
      return res.status(403).json({
        success: false,
        message: "Account has not been activated",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const payload = { id: user._id.toString(), role: user.role};
    const accessToken = jwtService.generateAccessToken(payload);
    const refreshToken = jwtService.generateRefreshToken(payload);

    user.refreshToken = hashRefreshToken(refreshToken);

    user.lastLoginAt = new Date();

    await user.save({validateBeforeSave: false});

    const userResponse = user.toObject();

    delete userResponse.password;
    delete userResponse.refreshToken;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;
    delete userResponse.passwordChangeCode;
    delete userResponse.passwordChangeCodeExpires;
    delete userResponse.pendingPassword;
    delete userResponse.pendingEmail;
    delete userResponse.emailChangeCode;
    delete userResponse.emailChangeCodeExpires;
    delete userResponse.activationToken;
    delete userResponse.activationTokenExpires;

    cookiesService.setTokens(res, accessToken, refreshToken );

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: userResponse,
    });
  };

  // ==================== Logout ====================

  logout = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: {
        refreshToken: 1,
      },
    });

    cookiesService.clearTokens(res);

    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  };

  // ==================== Get Current User ====================

  getCurrentUser = async (req, res) => {
    const user = await User.findById(req.user._id)
      .select(
        "_id fullName email phone role department avatar isAccountActivated isActive lastLoginAt createdBy createdAt updatedAt",
      ).populate("createdBy", "fullName email role",);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Current user retrieved successfully",
      data: user,
    });
  };

  // ==================== Request Password Change ====================

  requestPasswordChange = async (req, res) => {
    const { currentPassword } = req.body;

    const user = await User.findById(req.user._id).select(
      "+password +passwordChangeCode +passwordChangeCodeExpires",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isCurrentPasswordCorrect = await passwordService.compare(currentPassword, user.password);

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const verificationCode = verificationCodeService.generateVerificationCode();

    user.passwordChangeCode = verificationCodeService.hashVerificationCode(verificationCode);

    user.passwordChangeCodeExpires = new Date( Date.now() + 10 * 60 * 1000);

    if (!user.passwordChangeCodeExpires || user.passwordChangeCodeExpires <= new Date()) 
      {
        return res.status(400).json({
        success: false,
        message: "Verification code has expired",
        });
      }

    await user.save({validateBeforeSave: false});

    try {
      await emailService.sendPasswordChangeVerificationEmail({
        to: user.email,
        fullName: user.fullName,
        verificationCode,
      });
    } catch (error) {
      user.passwordChangeCode = undefined;
      user.passwordChangeCodeExpires = undefined;

      await user.save({validateBeforeSave: false});

      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
    });
  };

  // ==================== Verify Password Change ====================

  verifyPasswordChange = async (req, res) => {
    const {verificationCode, newPassword } = req.body;

    const user = await User.findById(req.user._id).select(
      "+password +passwordChangeCode +passwordChangeCodeExpires +refreshToken",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.passwordChangeCode) {
      return res.status(400).json({
        success: false,
        message: "No verification code found",
      });
    }

    if (
      !user.passwordChangeCodeExpires ||
      user.passwordChangeCodeExpires < Date.now()
    ) {
      user.passwordChangeCode = undefined;
      user.passwordChangeCodeExpires = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    const isVerificationCodeValid =
      verificationCodeService.verifyVerificationCode(
        verificationCode,
        user.passwordChangeCode,
      );

    if (!isVerificationCodeValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    const isSamePassword = await passwordService.compare(
      newPassword,
      user.password,
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    user.password = await passwordService.hash(newPassword);

    user.passwordChangeCode = undefined;
    user.passwordChangeCodeExpires = undefined;
    user.refreshToken = undefined;

    await user.save();

    cookiesService.clearTokens(res);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please sign in again.",
    });
  };

  // ==================== Forgot Password ====================

  forgotPassword = async (req, res) => {
    const { email } = req.body;

    const responseMessage =
      "If an account exists for this email address, you will receive password reset instructions shortly.";

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (
      !user ||
      !user.isAccountActivated ||
      !user.isActive
    ) {
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    const resetToken =
      verificationCodeService.generateResetToken();

    user.passwordResetToken =
      verificationCodeService.hashResetToken(
        resetToken,
      );

    user.passwordResetExpires = new Date(
      Date.now() + 15 * 60 * 1000,
    );

    await user.save({
      validateBeforeSave: false,
    });

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5173";

    const resetUrl =
      `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        resetUrl,
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      throw error;
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });
  };

  // ==================== Reset Password ====================

  resetPassword = async (req, res) => {
    const { token } = req.params;

    const { newPassword } = req.body;

    const hashedToken =
      verificationCodeService.hashResetToken(
        token,
      );

    const user = await User.findOne({
      passwordResetToken: hashedToken,

      passwordResetExpires: {
        $gt: new Date(),
      },

      isAccountActivated: true,

      isActive: true,
    }).select(
      "+password +passwordResetToken +passwordResetExpires +refreshToken",
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token",
      });
    }

    const isSamePassword = await passwordService.compare(
      newPassword,
      user.password,
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from your current password",
      });
    }

    user.password = await passwordService.hash(newPassword);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    user.passwordChangeCode = undefined;
    user.passwordChangeCodeExpires = undefined;

    user.refreshToken = undefined;

    await user.save();

    cookiesService.clearTokens(res);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please sign in again.",
    });
  };

  // ==================== Refresh Token ====================

  refreshToken = async (req, res) => {
    const currentRefreshToken =
      cookiesService.getRefreshToken(req);

    if (!currentRefreshToken) {
      cookiesService.clearTokens(res);

      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    let decodedToken;

    try {
      decodedToken =
        jwtService.verifyRefreshToken(
          currentRefreshToken,
        );
    } catch (error) {
      cookiesService.clearTokens(res);

      return res.status(401).json({
        success: false,
        message:
          error.name === "TokenExpiredError"
            ? "Refresh token has expired"
            : "Invalid refresh token",
      });
    }

    const user = await User.findById(
      decodedToken.id,
    ).select("+refreshToken");

    if (!user || !user.refreshToken) {
      cookiesService.clearTokens(res);

      return res.status(401).json({
        success: false,
        message: "Refresh session is no longer valid",
      });
    }

    const providedRefreshTokenHash =
      hashRefreshToken(
        currentRefreshToken,
      );

    const isRefreshTokenValid =
      compareRefreshTokens(
        providedRefreshTokenHash,
        user.refreshToken,
      );

    if (!isRefreshTokenValid) {
      user.refreshToken = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      cookiesService.clearTokens(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    if (!user.isAccountActivated) {
      user.refreshToken = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      cookiesService.clearTokens(res);

      return res.status(403).json({
        success: false,
        message: "Account has not been activated",
      });
    }

    if (!user.isActive) {
      user.refreshToken = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      cookiesService.clearTokens(res);

      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const payload = {
      id: user._id.toString(),
      role: user.role,
    };

    const newAccessToken =
      jwtService.generateAccessToken(
        payload,
      );

    const newRefreshToken =
      jwtService.generateRefreshToken(
        payload,
      );

    user.refreshToken =
      hashRefreshToken(
        newRefreshToken,
      );

    await user.save({
      validateBeforeSave: false,
    });

    cookiesService.setTokens(
      res,
      newAccessToken,
      newRefreshToken,
    );

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  };
}

module.exports = new AuthController();