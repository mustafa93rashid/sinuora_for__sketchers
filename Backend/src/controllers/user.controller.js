const { changeUser } = require("../helpers/userAdmin.helper");
const { getDashboardUrl } = require("../config/frontend");
const { versionFilter, disconnectUser, sensitiveUnset } = require("../helpers/session.helper");
const cookiesService = require("../utils/cookiesService");
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const { escapeRegex } = require("../helpers/search.helper");
const { buildPaginationResponse } = require("../helpers/pagination.helper");
const crypto = require("crypto");
const User = require("../models/user.model");

const passwordService = require("../utils/passwordService");
const verificationCodeService = require("../utils/verificationCodeService");

const emailService = require("../services/email.service");
const { uploadImage, saveWithImages } = require("../services/cloudinary.service");

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
    const user = await User.findOne({ _id: req.user._id, deletedAt: null });
    if (!user) fail("User not found", 404);
    if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    await user.validate();
    const oldImage = user.avatar?.publicId;
    const images = req.file ? [await uploadImage(req.file, "sinuora/users")] : [];
    if (images.length) user.avatar = images[0];
    await saveWithImages(user, images, images.length ? [oldImage] : []);
    return res.json({ success: true, data: user });
  };

  // ==================== Request Email Change ====================
  requestEmailChange = async (req, res) => {
    const normalizedEmail = req.body.newEmail.toLowerCase().trim();
    const user = await User.findOne({ _id: req.user._id, deletedAt: null, isActive: true }).select("+password");
    if (!user || !await passwordService.compare(req.body.currentPassword, user.password)) fail("Current password is incorrect");
    if (normalizedEmail === user.email) fail("New email must be different");
    if (await User.exists({ email: normalizedEmail })) fail("Email already in use", 409);
    const code = verificationCodeService.generateVerificationCode();
    const hash = verificationCodeService.hashVerificationCode(code);
    const updated = await User.updateOne({ _id: user._id, password: user.password, deletedAt: null, isActive: true, ...versionFilter(req.user.tokenVersion ?? 0) }, {
      $set: { pendingEmail: normalizedEmail, emailChangeCode: hash, emailChangeCodeExpires: new Date(Date.now() + 600000), emailChangeAttempts: 0 },
    });
    if (!updated.matchedCount) fail("Session changed; sign in again", 401);
    try {
      await emailService.sendEmailChangeVerificationEmail({ to: normalizedEmail, fullName: user.fullName, verificationCode: code });
    } catch (error) {
      await User.updateOne({ _id: user._id, emailChangeCode: hash }, { $unset: { pendingEmail: 1, emailChangeCode: 1, emailChangeCodeExpires: 1, emailChangeAttempts: 1 } });
      throw error;
    }
    return res.json({ success: true, message: "Verification code sent to the new email address" });
  };

  // ==================== Verify Email Change ====================
  verifyEmailChange = async (req, res) => {
    const user = await User.findOneAndUpdate({
      _id: req.user._id, deletedAt: null, isActive: true, ...versionFilter(req.user.tokenVersion ?? 0),
      emailChangeCodeExpires: { $gt: new Date() }, emailChangeAttempts: { $lt: 5 },
    }, { $inc: { emailChangeAttempts: 1 } }, { returnDocument: "after" }).select("+pendingEmail +emailChangeCode");
    if (!user?.pendingEmail || !user.emailChangeCode || !verificationCodeService.verifyVerificationCode(req.body.verificationCode, user.emailChangeCode)) fail("Invalid, expired or exhausted verification code");
    const runTransaction = require("../helpers/transaction.helper");
    const { queueSecurityEmail } = require("../services/maintenance.service");
    await runTransaction(async session => {
      const result = await User.updateOne({
        _id: user._id, deletedAt: null, isActive: true, ...versionFilter(user.tokenVersion ?? 0),
        emailChangeCode: user.emailChangeCode, pendingEmail: user.pendingEmail, emailChangeCodeExpires: { $gt: new Date() },
      }, { $set: { email: user.pendingEmail }, $inc: { tokenVersion: 1, __v: 1 }, $unset: sensitiveUnset }, { session, runValidators: true });
      if (!result.matchedCount) fail("Verification code already consumed or expired", 409);
      await queueSecurityEmail({ to: user.email, subject: "Your account email was changed", text: "Your account email address was changed. If you did not authorize this, contact your administrator immediately." }, session);
    });
    disconnectUser(user._id);
    cookiesService.clearTokens(res);
    return res.json({ success: true, message: "Email updated. Please sign in again." });
  };

  // ==================== Delete Profile Image ====================
  deleteProfileImage = async (req, res) => {
    const user = await User.findOne({ _id: req.user._id, deletedAt: null });
    if (!user?.avatar?.publicId) fail("Profile image not found", 404);
    const oldImage = user.avatar.publicId;
    user.avatar = { url: null, publicId: null };
    await saveWithImages(user, [], [oldImage]);
    return res.json({ success: true, data: { avatar: user.avatar } });
  };

  // ==================== Get All Users ====================
  getAllUsers = async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isActive,
    } = (req.validatedQuery || {});

    const filter = { deletedAt: null };

    if (search) {
      filter.$or = [
        {
          fullName: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
        {
          email: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },

        {
          phone: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
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
      pagination: buildPaginationResponse(pageNumber, limitNumber, totalUsers),
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

    const dashboardUrl = getDashboardUrl();

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
    const { token, password } = req.body;
    const hash = verificationCodeService.hashResetToken(token);
    const hashedPassword = await passwordService.hash(password);
    const user = await User.findOneAndUpdate({
      activationToken: hash, activationTokenExpires: { $gt: new Date() },
      isAccountActivated: false, deletedAt: null,
    }, {
      $set: { password: hashedPassword, isAccountActivated: true, isActive: true },
      $inc: { tokenVersion: 1, __v: 1 },
      $unset: { activationToken: 1, activationTokenExpires: 1, ...sensitiveUnset },
    }, { returnDocument: "after", runValidators: true });
    if (!user) fail("Invalid or expired activation token");
    return res.json({ success: true, message: "Account activated. Please sign in." });
  };

  // ==================== Update User Status ====================
  updateUserStatus = async (req, res) => {
    const user = await changeUser(req.user, req.params.id, { isActive: req.body.isActive });
    return res.json({ success: true, data: { id: user._id, fullName: user.fullName, isActive: user.isActive } });
  };

  // ==================== Update User Role ====================
  updateUserRole = async (req, res) => {
    const user = await changeUser(req.user, req.params.id, { role: req.body.role });
    return res.json({ success: true, data: { id: user._id, fullName: user.fullName, role: user.role } });
  };

  // ==================== Delete User ====================
  deleteUser = async (req, res) => {
    const user = await changeUser(req.user, req.params.id, { deletedAt: new Date(), isActive: false });
    return res.json({ success: true, message: "User deactivated and retained for audit history", data: { id: user._id } });
  };
}

module.exports = new UserController();
