const multer = require("multer");

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];
// ==================== Upload Constants ====================

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const PRODUCT_IMAGE_FILE_LIMIT = 10;

// ==================== Multer Memory Storage ====================

const memoryStorage = multer.memoryStorage();

// ==================== Create Upload Error ====================

const createUploadError = (message, code = "INVALID_FILE_TYPE") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

// ==================== Image File Filter ====================

const imageFileFilter = (req, file, callback) => {
  if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(
    createUploadError(
      "Only JPEG, PNG, GIF, and WebP images are allowed.",
      "INVALID_IMAGE_TYPE"
    ),
    false
  );
};

// ==================== Create Image Upload ====================

const createImageUpload = (filesLimit = PRODUCT_IMAGE_FILE_LIMIT) => {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: MAX_IMAGE_SIZE,
      files: filesLimit
    }
  });
};

// ==================== Upload Single Image ====================

const uploadSingle = (fieldName) => {
  return createImageUpload(1).single(fieldName);
};

// ==================== Upload Image Array ====================

const uploadArray = (fieldName, maxCount = PRODUCT_IMAGE_FILE_LIMIT) => {
  return createImageUpload(maxCount).array(fieldName, maxCount);
};

// ==================== Product Images Upload ====================

const uploadProductImages = () => {
  return createImageUpload(PRODUCT_IMAGE_FILE_LIMIT).array(
    "images",
    PRODUCT_IMAGE_FILE_LIMIT
  );
};

// ==================== User Avatar Upload ====================

const uploadUserAvatar = () => {
  return createImageUpload(1).single("avatar");
};

// ==================== Exports ====================

module.exports = {
  MAX_IMAGE_SIZE,
  PRODUCT_IMAGE_FILE_LIMIT,
  createUploadError,
  imageFileFilter,
  createImageUpload,
  uploadSingle,
  uploadArray,
  uploadProductImages,
  uploadUserAvatar
};