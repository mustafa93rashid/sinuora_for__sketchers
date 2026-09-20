const { Server } = require("socket.io");

const User = require("../models/user.model");

const jwtService = require("../utils/jwtService");

let io;

// ==================== Allowed Socket Roles ====================

const ALLOWED_ROLES = [
        "superadmin",
        "manager",
        "saler",
        "follow-up",
];

// ==================== Get Allowed Origins ====================

const getAllowedOrigins = () => {
  return [process.env.CLIENT_URL, process.env.DASHBOARD_URL].filter(Boolean);
};

// ==================== Extract Access Token From Cookie Header ====================

const extractAccessTokenFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
};

// ==================== Extract Socket Token ====================

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;

  if (authToken) {
    return authToken;
  }

  const authorizationHeader = socket.handshake.headers?.authorization;

  if (authorizationHeader) {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);

    if (bearerMatch) {
      return bearerMatch[1].trim() || null;
    }
  }

  return extractAccessTokenFromCookieHeader(socket.handshake.headers?.cookie);
};

// ==================== Initialize Socket Server ====================

const initializeSocket = (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
      methods: ["GET", "POST"],
    },

    transports: ["websocket", "polling"],

    pingTimeout: 20000,

    pingInterval: 25000,
  });

  // ==================== Authenticate Socket Connection ====================

  io.use(async (socket, next) => {
    try {
      const accessToken = extractSocketToken(socket);

      if (!accessToken) {
        return next(new Error("Authentication token is required"));
      }

      let decodedToken;

      try {
        decodedToken = jwtService.verifyAccessToken(accessToken);
      } catch (error) {
        return next(
          new Error(
            error.name === "TokenExpiredError"
              ? "Authentication token has expired"
              : "Invalid authentication token",
          ),
        );
      }

      if (!decodedToken?.id) {
        return next(new Error("Invalid authentication token payload"));
      }

      const user = await User.findById(decodedToken.id)
        .select("_id role isActive isAccountActivated")
        .lean();

      if (!user) {
        return next(new Error("Authenticated user was not found"));
      }

      if (!user.isAccountActivated) {
        return next(new Error("User account has not been activated"));
      }

      if (!user.isActive) {
        return next(new Error("User account is inactive"));
      }

      if (!ALLOWED_ROLES.includes(user.role)) {
        return next(new Error("User role is not authorized"));
      }

      socket.user = {
        id: user._id.toString(),
        role: user.role,
      };

      return next();
    } catch (error) {
      return next(new Error("Socket authentication failed"));
    }
  });

  // ==================== Handle Socket Connection ====================

  io.on("connection", (socket) => {
    const userRoom = `user:${socket.user.id}`;

    const roleRoom = `role:${socket.user.role}`;

    socket.join(userRoom);

    socket.join(roleRoom);

    socket.emit("socket:connected", {
      success: true,
      message: "Socket connected successfully",
      data: {
        socketId: socket.id,
        userId: socket.user.id,
        role: socket.user.role,
      },
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} - ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error: ${socket.id}`, error);
    });
  });

  return io;
};

// ==================== Get Socket Server ====================

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

// ==================== Emit To User ====================

const emitToUser = (userId, eventName, payload) => {
  if (!userId || !eventName) {
    throw new Error("User ID and event name are required");
  }

  getIO().to(`user:${userId}`).emit(eventName, payload);
};

// ==================== Emit To Role ====================

const emitToRole = (role, eventName, payload) => {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid notification role");
  }

  if (!eventName) {
    throw new Error("Event name is required");
  }

  getIO().to(`role:${role}`).emit(eventName, payload);
};

// ==================== Emit To Multiple Roles ====================

const emitToRoles = (roles, eventName, payload) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error("At least one role is required");
  }

  if (!eventName) {
    throw new Error("Event name is required");
  }

  const validRoles = [
    ...new Set(roles.filter((role) => ALLOWED_ROLES.includes(role))),
  ];

  if (validRoles.length === 0) {
    throw new Error("No valid notification roles were provided");
  }

  const roleRooms = validRoles.map((role) => `role:${role}`);

  getIO().to(roleRooms).emit(eventName, payload);
};

// ==================== Exports ====================

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRole,
  emitToRoles,
};
