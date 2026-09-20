const multer = require("multer");

// ==================== Global Error Handler ====================

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // ==================== Multer Errors ====================

  if (err instanceof multer.MulterError) {
    let message = "Upload error";

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File size must not exceed 5 MB";
        break;

      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded";
        break;

      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field";
        break;

      default:
        message = err.message;
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }

  // ==================== Custom Application Errors ====================

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // ==================== Mongoose Validation Error ====================

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // ==================== Invalid ObjectId ====================

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource ID",
    });
  }

  // ==================== Duplicate Key ====================

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];

    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // ==================== Internal Server Error ====================

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};

module.exports = errorHandler;
