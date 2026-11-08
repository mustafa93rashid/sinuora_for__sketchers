const getDashboardUrl = () => (
  process.env.DASHBOARD_URL || process.env.FRONTEND_URL ||
  (process.env.NODE_ENV !== "production" ? process.env.DASHBOARD_URL_LOCAL : "") || ""
).replace(/\/+$/, "");
const getFrontendUrl = () => (process.env.FRONTEND_URL || getDashboardUrl()).replace(/\/+$/, "");
module.exports = { getDashboardUrl, getFrontendUrl };
