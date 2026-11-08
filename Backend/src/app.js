// ==================== Load Environment Variables ====================

if (require.main === module) {
  require("dotenv").config();
}

// ==================== Dependencies ====================

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cookies = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");

// ==================== Configuration ====================

const {
  initializeSocket,
  getIO,
} = require("./config/socket");

const {
  getAllowedOrigins,
} = require("./config/origins");

const {
  validateConfiguration,
  initializeDatabase,
} = require("./config/startup");

// ==================== Middleware ====================

const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const xssSanitize = require("./middlewares/xss");

// ==================== Services ====================

const {
  startMaintenance,
  stopMaintenance,
} = require("./services/maintenance.service");

// ==================== Application Setup ====================

const app = express();

const server = http.createServer(app);

app.use(helmet());

app.set(
  "trust proxy",
  Number(process.env.TRUST_PROXY_HOPS || 0),
);

// ==================== CORS Configuration ====================

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header.
      // Examples: Postman, health checks and server-to-server requests.

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Not allowed by CORS");

      error.statusCode = 403;

      return callback(error);
    },

    credentials: true,
  }),
);

// ==================== Middleware Setup ====================

app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(cookies());

app.use(xssSanitize);

// ==================== Disable API Cache ====================

app.use("/api/v1", (req, res, next) => {
  res.set({
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",

    Pragma: "no-cache",

    Expires: "0",

    "Surrogate-Control": "no-store",
  });

  return next();
});

// ==================== Health Check ====================

app.get("/api/health", (req, res) => {
  const isDatabaseConnected =
    mongoose.connection.readyState === 1;

  const statusCode = isDatabaseConnected ? 200 : 503;

  return res.status(statusCode).json({
    success: isDatabaseConnected,

    message: isDatabaseConnected
      ? "Server is ready"
      : "Database unavailable",
  });
});

// ==================== API Routes ====================

app.use(
  "/api/v1/auth",
  require("./routers/auth.routes"),
);

app.use(
  "/api/v1/users",
  require("./routers/user.routes"),
);

app.use(
  "/api/v1/products",
  require("./routers/product.route"),
);

app.use(
  "/api/v1/product-variants",
  require("./routers/productVariant.routes"),
);

app.use(
  "/api/v1/inventory",
  require("./routers/inventory.routes"),
);

app.use(
  "/api/v1/orders",
  require("./routers/order.routes"),
);


app.use(
  "/api/v1/dashboard",
  require("./routers/dashboard.routes"),
);

// ==================== Error Handling ====================

app.use(notFound);

app.use(errorHandler);

// ==================== Start Server ====================

const start = async () => {
  // ==================== Validate Configuration ====================

  validateConfiguration();

  // ==================== Connect To Database ====================

  await mongoose.connect(process.env.MONGODB_URL);

  // ==================== Initialize Database ====================

  await initializeDatabase();

  // ==================== Initialize Socket.IO ====================

  initializeSocket(server);

  // ==================== Listen For Requests ====================

  const PORT = process.env.PORT || 3000;

  await new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(PORT, "0.0.0.0", resolve);
  });

  // ==================== Start Maintenance ====================

  startMaintenance();

  console.log("Server ready");

  return server;
};

// ==================== Stop Server ====================

const stop = async () => {
  // ==================== Stop Maintenance ====================

  await stopMaintenance();

  // ==================== Close Server Connections ====================

  if (server.listening) {
    try {
      getIO().disconnectSockets(true);
    } catch {
      // Socket.IO may not have been initialized.
    }

    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  // ==================== Disconnect Database ====================

  await mongoose.disconnect();
};

// ==================== Run Application ====================

if (require.main === module) {
  // ==================== Handle Startup Failure ====================

  start().catch(async (error) => {
    console.error(
      "Startup failed:",
      error.message,
    );

    await stop();

    process.exitCode = 1;
  });

  // ==================== Handle Shutdown Signals ====================

  const shutdownSignals = [
    "SIGINT",
    "SIGTERM",
  ];

  for (const signal of shutdownSignals) {
    process.once(signal, () => {
      stop().then(() => {
        process.exit(0);
      });
    });
  }
}

// ==================== Exports ====================

module.exports = {
  app,
  start,
  stop,
};