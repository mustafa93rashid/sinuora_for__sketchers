const mongoose = require("mongoose");
const { getAllowedOrigins } = require("./origins");
const { getDashboardUrl } = require("./frontend");
const validateConfiguration = () => {
  const required = ["MONGODB_URL", "JWT_SECRET_KEY", "REFRESH_JWT_SECRET_KEY", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
  if (!getDashboardUrl()) throw new Error("Set DASHBOARD_URL or FRONTEND_URL (DASHBOARD_URL_LOCAL is also accepted in development)");
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URL)) throw new Error("Invalid MongoDB URL scheme");
  if (process.env.JWT_SECRET_KEY.length < 32 || process.env.REFRESH_JWT_SECRET_KEY.length < 32 || process.env.JWT_SECRET_KEY === process.env.REFRESH_JWT_SECRET_KEY) throw new Error("JWT secrets must be distinct and at least 32 characters");
  for (const key of ["JWT_ACCESS_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN"]) {
    if (process.env[key] && !/^[1-9]\d*(s|m|h|d)$/.test(process.env[key])) throw new Error(`${key} must be a duration such as 15m or 7d`);
  }
  const port = Number(process.env.EMAIL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid EMAIL_PORT");
  if (process.env.EMAIL_SECURE && !["true", "false"].includes(process.env.EMAIL_SECURE)) throw new Error("EMAIL_SECURE must be true or false");
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error("Invalid TRUST_PROXY_HOPS");
  const origins = getAllowedOrigins();
  for (const origin of origins) {
    if (!/^https?:\/\//.test(origin)) throw new Error("Frontend origins must use HTTP or HTTPS");
  }
};
const assertTransactionsAvailable = async () => {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("MongoDB must be a replica set or sharded cluster; standalone does not support the required transactions");
};
const initializeDatabase = async () => {
  await assertTransactionsAvailable();
  const models = ["user", "product", "productVariant", "order", "orderReturn", "orderStatusHistory", "inventoryTransaction", "maintenanceJob"];
  for (const name of models) await require(`../models/${name}.model`).createIndexes();
  const { Guard } = require("../helpers/userAdmin.helper");
  await Guard.init();
};
module.exports = { validateConfiguration, assertTransactionsAvailable, initializeDatabase };
