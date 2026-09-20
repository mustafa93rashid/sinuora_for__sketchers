const User = require("../models/user.model");

const jwtService = require("../utils/jwtService");
const cookiesService = require("../utils/cookiesService");

// ==================== Extract Access Token ====================

const extractAccessToken = (req) => {
  const cookieToken = cookiesService.getAccessToken(req);

  if (cookieToken) {
    return cookieToken;
  }

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return null;
  }

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    return null;
  }

  return bearerMatch[1].trim() || null;
};
 
// ==================== Authentication Middleware ====================

const auth = async (req, res, next) => {
  try {
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Auth: Authentication is required",
      });
    }

    let decodedToken;

    try {
      decodedToken = jwtService.verifyAccessToken(accessToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message:
          error.name === "TokenExpiredError"
            ? "Auth: Access token has expired"
            : "Auth: Invalid access token",
      });
    }

    if (!decodedToken?.id) {
      return res.status(401).json({
        success: false,
        message: "Auth: Invalid access token payload",
      });
    }

    const user = await User.findById(decodedToken.id)
      .select(
        "_id fullName email phone role department avatar isAccountActivated isActive",
      )
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Auth: Authenticated user was not found",
      });
    }

    if (!user.isAccountActivated) {
      return res.status(403).json({
        success: false,
        message: "Auth: Your account has not been activated",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Auth: Your account is inactive",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = auth;
