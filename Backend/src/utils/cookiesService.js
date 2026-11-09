// ==================== Cookie Configuration ====================

const isProduction =
  process.env.NODE_ENV === "production";

// Derive the cookie lifetime from the same duration string jwtService
// uses to sign the token, instead of a separately hardcoded value that
// can drift out of sync with the token's actual expiry (audit finding
// L-2 - the cookie previously outlived the access token by 45 minutes
// under the default 15m configuration).
const DURATION_UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

const parseDurationMs = (value) => {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);

  if (!match) throw new Error(`Invalid duration: ${value}`);

  return Number(match[1]) * DURATION_UNIT_MS[match[2]];
};

const ACCESS_TOKEN_MAX_AGE =
  parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN || "15m");

const REFRESH_TOKEN_MAX_AGE =
  parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d");

const DEFAULT_COOKIE_MAX_AGE =
  15 * 60 * 1000; // 15 minutes

// ==================== Base Cookie Options ====================

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

// ==================== Cookies Service ====================

class CookiesService {
  // ==================== Set Cookie ====================

  setData = (res ,key, value, maxAge = DEFAULT_COOKIE_MAX_AGE ) => {
    res.cookie(key, value, {...baseCookieOptions, maxAge});
  };

  // ==================== Get Cookie ====================

  getData = (req, key) => {
    return req.cookies?.[key] || null;
  };

  // ==================== Clear Cookie ====================

  clearData = (res, key ) => {
    res.clearCookie(key, {...baseCookieOptions});
  };

  // ==================== Set Access Token ====================

  setAccessToken = (res, accessToken ) => {
    this.setData(res, "accessToken", accessToken, ACCESS_TOKEN_MAX_AGE);
  };

  // ==================== Set Refresh Token ====================

  setRefreshToken = (res, refreshToken) => {
    this.setData(res, "refreshToken", refreshToken, REFRESH_TOKEN_MAX_AGE);
  };

  // ==================== Set Authentication Tokens ====================

  setTokens = (res, accessToken, refreshToken) => {
    this.setAccessToken(res, accessToken);
    this.setRefreshToken(res, refreshToken);
  };

  // ==================== Get Access Token ====================

  getAccessToken = (req) => {
    return this.getData(req, "accessToken");
  };

  // ==================== Get Refresh Token ====================

  getRefreshToken = (req) => {
    return this.getData(req, "refreshToken");
  };

  // ==================== Clear Authentication Tokens ====================

  clearTokens = (res) => {
    this.clearData(res, "accessToken");
    this.clearData(res,"refreshToken");
  };
}

module.exports = new CookiesService();