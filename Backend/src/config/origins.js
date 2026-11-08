const normalizeOrigin = (value) => {
  const trimmed = String(value).trim();

  if (!trimmed) return null;

  // Platforms like Vercel inject VERCEL_URL as a bare hostname with no
  // scheme (e.g. "my-app.vercel.app"), which `new URL()` cannot parse
  // on its own. Assume HTTPS when no scheme is present.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    console.warn(`[origins] Ignoring invalid origin configuration value: ${trimmed}`);
    return null;
  }
};

const getAllowedOrigins = () => [...new Set([
  process.env.DASHBOARD_URL, process.env.WEBSITE_URL, process.env.FRONTEND_URL,
  process.env.DASHBOARD_URL_LOCAL, process.env.WEBSITE_URL_LOCAL,
  process.env.CLIENT_URL, process.env.VERCEL_URL,
].filter(Boolean).map(normalizeOrigin).filter(Boolean))];

module.exports = { getAllowedOrigins };
