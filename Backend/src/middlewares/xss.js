const xss = require("xss");

// ==================== Sanitize Input ====================

const sanitizeInput = (value) => {
  if (typeof value === "string") {
    return xss(value, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script", "style"],
    }).trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item));
  }

  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => {
      value[key] = sanitizeInput(value[key]);
    });
  }

  return value;
};

// ==================== XSS Sanitize Middleware ====================

const xssSanitize = (req, res, next) => {
  req.body = sanitizeInput(req.body);

  req.query = sanitizeInput(req.query);

  req.params = sanitizeInput(req.params);

  return next();
};

module.exports = xssSanitize;
