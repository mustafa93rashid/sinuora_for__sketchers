// ==================== Cookie Configuration ====================

const isProduction =
  process.env.NODE_ENV === "production";

const ACCESS_TOKEN_MAX_AGE =
  60 * 60 * 1000; // 1 hour

const REFRESH_TOKEN_MAX_AGE =
  7 * 24 * 60 * 60 * 1000; // 7 days

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