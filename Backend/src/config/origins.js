const getAllowedOrigins = () => [...new Set([
  process.env.DASHBOARD_URL, process.env.WEBSITE_URL, process.env.FRONTEND_URL,
  process.env.DASHBOARD_URL_LOCAL, process.env.WEBSITE_URL_LOCAL,
  process.env.CLIENT_URL, process.env.VERCEL_URL,
].filter(Boolean).map(value => new URL(value).origin))];
module.exports = { getAllowedOrigins };
