const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const sign = (payload, type, secret, expiresIn) => jwt.sign(
  { ...payload, type }, secret, { algorithm: "HS256", expiresIn, jwtid: randomUUID() },
);
const verify = (token, type, secret) => {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (payload.type !== type || !Number.isSafeInteger(payload.ver) || payload.ver < 0 || !payload.jti || !Number.isSafeInteger(payload.exp)) throw new Error("Invalid session token");
  return payload;
};
module.exports = {
  generateAccessToken: payload => sign(payload, "access", process.env.JWT_SECRET_KEY, process.env.JWT_ACCESS_EXPIRES_IN || "15m"),
  generateRefreshToken: payload => sign(payload, "refresh", process.env.REFRESH_JWT_SECRET_KEY, process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
  verifyAccessToken: token => verify(token, "access", process.env.JWT_SECRET_KEY),
  verifyRefreshToken: token => verify(token, "refresh", process.env.REFRESH_JWT_SECRET_KEY),
};
