const mongoose = require("mongoose");

// ==================== User Schema ====================

const userSchema = new mongoose.Schema(
  {
    // ==================== Basic Information ====================

    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    // ==================== Authentication ====================

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "superadmin",
        "manager",
        "saler",
        "follow-up",
      ],
      required: true,
    },

    // ==================== Profile ====================

    avatar: {
      url: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },
    },

    // ==================== Refresh Token ====================

    refreshToken: {
      type: String,
      select: false,
      default: undefined,
    },

    // ==================== Password Reset ====================

    passwordResetToken: {
      type: String,
      select: false,
      default: undefined,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
      default: undefined,
    },

    // ==================== Password Change ====================

    passwordChangeCode: {
      type: String,
      select: false,
      default: undefined,
    },

    passwordChangeCodeExpires: {
      type: Date,
      select: false,
      default: undefined,
    },

    pendingPassword: {
      type: String,
      select: false,
      default: undefined,
    },

    // ==================== Email Change ====================

    pendingEmail: {
      type: String,
      select: false,
      lowercase: true,
      trim: true,
      default: undefined,
    },

    emailChangeCode: {
      type: String,
      select: false,
      default: undefined,
    },

    emailChangeCodeExpires: {
      type: Date,
      select: false,
      default: undefined,
    },

    // ==================== Account Activation ====================

    activationToken: {
      type: String,
      select: false,
      default: undefined,
    },

    activationTokenExpires: {
      type: Date,
      select: false,
      default: undefined,
    },

    isAccountActivated: {
      type: Boolean,
      default: false,
    },

    // ==================== Account Status ====================

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // ==================== Audit Information ====================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ==================== User Model ====================

const User = mongoose.model("User", userSchema);

module.exports = User;