const crypto = require("crypto");
const User = require("../models/user.model");
const cloudinary = require("../config/cloudinary");

const passwordService = require("../utils/passwordService");
const verificationCodeService = require("../utils/verificationCodeService");

const emailService = require("../services/email.service");
const { replaceImage, deleteImage } = require("../services/cloudinary.service");

class UserController {
  // ==================== Get Profile ====================
  getProfile = async (req, res) => {
    const user = await User.findById(req.user._id)
      .select("-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",)
      .populate("createdBy", "fullName email role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: user,
    });
  };

  // ==================== Update Profile ====================
  // Deliberately does NOT accept `email` — see requestEmailChange /
  // verifyEmailChange below. updateProfileValidation already rejects an
  // `email` key with a 400 before this runs, so there's nothing to guard
  // here; this comment exists so a future edit doesn't "helpfully" re-add
  // direct email writes to this endpoint.
  updateProfile = async (req, res) => {
    const { fullName, phone} = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (fullName !== undefined) {
      user.fullName = fullName;
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (req.file) {
      const uploadedImage = await replaceImage({
        oldPublicId: user.avatar?.publicId,
        file: req.file,
        folder: "users",
        prefix: user._id.toString(),
      });

      user.avatar = {
        url: uploadedImage.url,
        publicId: uploadedImage.publicId,
      };
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select(
      "-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  };

  // ==================== Request Email Change ====================
  requestEmailChange = async (req, res) => {
    const { newEmail } = req.body;

    const normalizedEmail = newEmail.toLowerCase().trim();

    if (normalizedEmail === req.user.email) {
      return res.status(400).json({
        success: false,
        message: "New email must be different from your current email.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: {
        $ne: req.user._id,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const verificationCode = verificationCodeService.generateVerificationCode();

    user.pendingEmail = normalizedEmail;

    user.emailChangeCode =
      verificationCodeService.hashVerificationCode(verificationCode);

    user.emailChangeCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save({
      validateBeforeSave: false,
    });

    try {
      // Sent to the NEW address only — the current email is never notified
      // and never touched until verification succeeds.
      await emailService.sendEmailChangeVerificationEmail({
        to: normalizedEmail,
        fullName: user.fullName,
        verificationCode,
      });
    } catch (error) {
      user.pendingEmail = undefined;
      user.emailChangeCode = undefined;
      user.emailChangeCodeExpires = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to the new email address.",
    });
  };

  // ==================== Verify Email Change ====================
  verifyEmailChange = async (req, res) => {
    const { verificationCode } = req.body;

    const user = await User.findById(req.user._id).select(
      "+pendingEmail +emailChangeCode +emailChangeCodeExpires",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.pendingEmail || !user.emailChangeCode) {
      return res.status(400).json({
        success: false,
        message: "No pending email change found.",
      });
    }

    if (
      !user.emailChangeCodeExpires ||
      user.emailChangeCodeExpires < Date.now()
    ) {
      // Only the code is cleared on expiry — `pendingEmail` is kept so
      // Resend can issue a fresh code without asking the user to retype
      // the new address.
      user.emailChangeCode = undefined;
      user.emailChangeCodeExpires = undefined;

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
        user.emailChangeCode,
      );

    if (!isVerificationCodeValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Re-checked here, not just at request time — someone else could have
    // claimed this address while verification was pending.
    const existingUser = await User.findOne({
      email: user.pendingEmail,
      _id: {
        $ne: user._id,
      },
    });

    if (existingUser) {
      user.pendingEmail = undefined;
      user.emailChangeCode = undefined;
      user.emailChangeCodeExpires = undefined;

      await user.save({
        validateBeforeSave: false,
      });

      return res.status(409).json({
        success: false,
        message:
          "This email address was just claimed by another account. Please request a new verification code with a different address.",
      });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.emailChangeCode = undefined;
    user.emailChangeCodeExpires = undefined;

    await user.save();

    const updatedUser = await User.findById(user._id).select(
      "-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",
    );

    return res.status(200).json({
      success: true,
      message: "Email address updated successfully.",
      data: updatedUser,
    });
  };

  // ==================== Delete Profile Image ====================
  deleteProfileImage = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.avatar?.publicId) {
      return res.status(404).json({
        success: false,
        message: "Profile image not found",
      });
    }

    await deleteImage(user.avatar.publicId);

    user.avatar = {
      url: null,
      publicId: null,
    };

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "Profile image deleted successfully",
      data: {
        avatar: user.avatar,
      },
    });
  };

  // ==================== Get All Users ====================
  getAllUsers = async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      department,
      isActive,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        {
          fullName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },

        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (department) {
      filter.department = department;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Math.max(Number(limit), 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select(
          "-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",
        )
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      results: users.length,
      pagination: {
        currentPage: pageNumber,
        limit: limitNumber,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limitNumber),
      },
      data: users,
    });
  };

  // ==================== Get User By ID ====================
  getUserById = async (req, res) => {
    const user = await User.findById(req.params.id).select(
      "-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  };

  // ==================== Create User ====================
  createUser = async (req, res) => {
    const { fullName, email, role } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists",
      });
    }

    const activationToken = verificationCodeService.generateResetToken();

    const hashedActivationToken =
      verificationCodeService.hashResetToken(activationToken);

    const temporaryPassword = crypto.randomBytes(32).toString("hex");

    const hashedTemporaryPassword =
      await passwordService.hash(temporaryPassword);

    const user = await User.create({
      fullName,
      email: normalizedEmail,
      role,
      password: hashedTemporaryPassword,
      isActive: false,
      isAccountActivated: false,
      activationToken: hashedActivationToken,
      activationTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
      createdBy: req.user._id,
    });

    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:5173";

    const activationUrl = `${dashboardUrl}/activate-account/${activationToken}`;

    try {
      await emailService.sendAccountActivationEmail({
        to: user.email,
        fullName: user.fullName,
        activationUrl,
      });
    } catch (error) {
      await User.findByIdAndDelete(user._id);

      throw error;
    }

    const createdUser = await User.findById(user._id).select(
      "-password -passwordResetToken -passwordResetExpires -activationToken -activationTokenExpires",
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully. An activation email has been sent.",
      data: createdUser,
    });
  };

  // ==================== Activate Account ====================
  activateAccount = async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Activation token is required.",
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const hashedActivationToken = verificationCodeService.hashResetToken(
      token.trim(),
    );

    const user = await User.findOne({
      activationToken: hashedActivationToken,
      activationTokenExpires: {
        $gt: new Date(),
      },
    }).select("+activationToken +activationTokenExpires +password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired activation token.",
      });
    }

    if (user.isAccountActivated) {
      return res.status(400).json({
        success: false,
        message: "Account is already activated.",
      });
    }

    user.password = await passwordService.hash(password);

    user.isActive = true;
    user.isAccountActivated = true;
    user.activationToken = undefined;
    user.activationTokenExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account activated successfully. You can now sign in.",
    });
  };

  // ==================== Update User Status ====================
  updateUserStatus = async (req, res) => {
    const { isActive } = req.body;

    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      user.role === "superadmin" &&
      user.isActive === true &&
      isActive === false
    ) {
      const activeSuperAdminsCount = await User.countDocuments({
        role: "superadmin",
        isActive: true,
      });

      if (activeSuperAdminsCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "The last active Super Admin cannot be deactivated",
        });
      }
    }

    if (user.isActive === isActive) {
      return res.status(400).json({
        success: false,
        message: isActive
          ? "User account is already active"
          : "User account is already inactive",
      });
    }

    user.isActive = isActive;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User activated successfully"
        : "User deactivated successfully",
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  };

  // ==================== Update User Role ====================
  updateUserRole = async (req, res) => {
    const { role } = req.body;

    const allowedRoles = [
      "superadmin",
      "manager",
      "equipmentManager",
      "hrManager",
      "contentManager",
    ];

    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === role) {
      return res.status(400).json({
        success: false,
        message: "User already has this role",
      });
    }

    if (
      user.role === "superadmin" &&
      role !== "superadmin" &&
      user.isActive === true
    ) {
      const activeSuperAdminsCount = await User.countDocuments({
        role: "superadmin",
        isActive: true,
      });

      if (activeSuperAdminsCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "The last active Super Admin cannot have its role changed",
        });
      }
    }

    user.role = role;

    await user.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  };

  // ==================== Delete User ====================
  deleteUser = async (req, res) => {
    const userId = req.params.id;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "superadmin" && user.isActive) {
      const activeSuperAdminsCount = await User.countDocuments({
        role: "superadmin",
        isActive: true,
      });

      if (activeSuperAdminsCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "The last active Super Admin cannot be deleted",
        });
      }
    }

    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }

    await user.deleteOne();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  };
}

module.exports = new UserController();
