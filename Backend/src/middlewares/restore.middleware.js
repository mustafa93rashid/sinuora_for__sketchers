const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ==================== Constants ====================

const MAX_RESTORE_FILE_SIZE = 1024 * 1024 * 1024;
const RESTORE_FIELD_NAME = "backup";

// ==================== Create Restore Temp Directory ====================

const createRestoreTempDirectory = () => {
  const directory = path.join(
    os.tmpdir(),
    "lsa-restore-uploads",
  );

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }

  return directory;
};

// ==================== Storage ====================

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(
      null,
      createRestoreTempDirectory(),
    );
  },

  filename: (req, file, callback) => {
    const timestamp = Date.now();

    const randomValue = Math.round(
      Math.random() * 1e9,
    );

    callback(
      null,
      `restore-${timestamp}-${randomValue}.zip`,
    );
  },
});

// ==================== Validate Restore File ====================

const fileFilter = (req, file, callback) => {
  const originalName =
    file.originalname?.toLowerCase() || "";

  const extension =
    path.extname(originalName);

  const allowedMimeTypes = [
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
  ];

  const validExtension =
    extension === ".zip";

  const validMimeType =
    allowedMimeTypes.includes(file.mimetype);

  if (
    !validExtension ||
    !validMimeType
  ) {
    const error = new Error(
      "Only ZIP backup files are allowed",
    );

    error.statusCode = 400;
    error.code =
      "INVALID_RESTORE_FILE_TYPE";

    callback(error);

    return;
  }

  callback(null, true);
};

// ==================== Multer Upload ====================

const restoreUpload = multer({
  storage,

  limits: {
    fileSize:
      MAX_RESTORE_FILE_SIZE,

    files: 1,
  },

  fileFilter,
});

// ==================== Upload Restore Backup ====================

const uploadRestoreBackup = () => {
  return restoreUpload.single(
    RESTORE_FIELD_NAME,
  );
};

// ==================== Restore Upload Error Handler ====================

const handleRestoreUploadError = (
  error,
  req,
  res,
  next,
) => {
  if (!error) {
    return next();
  }

  if (
    error instanceof multer.MulterError
  ) {
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      const uploadError =
        new Error(
          "Backup file must not exceed 1 GB",
        );

      uploadError.statusCode = 400;
      uploadError.code =
        "RESTORE_FILE_TOO_LARGE";

      return next(
        uploadError,
      );
    }

    if (
      error.code ===
      "LIMIT_UNEXPECTED_FILE"
    ) {
      const uploadError =
        new Error(
          `Unexpected file field. Use "${RESTORE_FIELD_NAME}"`,
        );

      uploadError.statusCode = 400;
      uploadError.code =
        "RESTORE_UNEXPECTED_FILE_FIELD";

      return next(
        uploadError,
      );
    }

    const uploadError =
      new Error(
        error.message ||
          "Failed to upload backup file",
      );

    uploadError.statusCode = 400;
    uploadError.code =
      "RESTORE_UPLOAD_FAILED";

    return next(
      uploadError,
    );
  }

  return next(error);
};

// ==================== Exports ====================

module.exports = {
  uploadRestoreBackup,
  handleRestoreUploadError,
};