// src/seeds/superAdmin.seed.js
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("..//src/models/user.model");
const passwordService = require("../src/utils/passwordService");

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required",
      );
    }

    const existingSuperAdmin = await User.findOne({
      role: "superadmin",
    });

    if (existingSuperAdmin) {
      console.log("Super Admin already exists");
      return;
    }

    const hashedPassword = await passwordService.hash(password);

    await User.create({
      fullName: "Super Admin",
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "superadmin",
      isActive: true,
        isAccountActivated: true,

    });

    console.log("Super Admin created successfully");
  } catch (error) {
    console.error("Failed to create Super Admin:", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createSuperAdmin();
