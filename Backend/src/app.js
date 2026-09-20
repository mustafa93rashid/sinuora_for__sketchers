require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cookies = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");

const { initializeSocket } = require("./config/socket");

const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const xssSanitize = require("./middlewares/xss");

const app = express();

app.set("trust proxy", 1);

const server = http.createServer(app);

//=========================================================================
// CORS Configuration
//=========================================================================
 
const allowedOrigins = [
  process.env.DASHBOARD_URL,
  process.env.WEBSITE_URL,
  process.env.DASHBOARD_URL_LOCAL,
  process.env.WEBSITE_URL_LOCAL,
  process.env.VERCEL_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin header
      // such as Postman, curl, health checks, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

//=========================================================================
// Middleware Setup
//=========================================================================
app.use(express.json());
app.use(morgan("dev"));
app.use(cookies());
app.use(xssSanitize);

//=========================================================================
// Disable API Cache
//=========================================================================

app.use("/api/v1", (req, res, next) => {
  res.set({
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",

    Pragma: "no-cache",

    Expires: "0",

    "Surrogate-Control": "no-store",
  });

  next();
});

//=========================================================================
// API Routes
//=========================================================================

// Health check route
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

//=========================================================================
// Error Handling Middleware
//=========================================================================
app.use(notFound);
app.use(errorHandler);

//=========================================================================
// Server Initialization
//=========================================================================
const PORT = process.env.PORT || 3000;
const MONGODB_URL = process.env.MONGODB_URL;

// Initialize Socket.IO
initializeSocket(server);

// Connect to MongoDB and start the server
mongoose
  .connect(MONGODB_URL)
  .then(() => {
    console.log("Connected to MongoDB Successfully");

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1);
  });