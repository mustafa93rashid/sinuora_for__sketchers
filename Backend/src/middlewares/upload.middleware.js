const multer = require("multer");

const { IMAGE_MIME_TYPES } = require("../services/cloudinary.service");

// ==================== Upload Constants ====================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

const MAX_COMPANY_PROFILE_SIZE = 20 * 1024 * 1024;

const DEFAULT_IMAGE_FILE_LIMIT = 10;

const DEFAULT_DOCUMENT_FILE_LIMIT = 5;

const PROJECT_IMAGE_FILE_LIMIT = 32;

// ==================== Document MIME Types ====================

const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const PDF_MIME_TYPES = ["application/pdf"];

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
      "INVALID_IMAGE_TYPE",
    ),
    false,
  );
};

// ==================== Document File Filter ====================

const documentFileFilter = (req, file, callback) => {
  if (DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(
    createUploadError(
      "Only PDF, DOC, and DOCX files are allowed.",
      "INVALID_DOCUMENT_TYPE",
    ),
    false,
  );
};

// ==================== PDF File Filter ====================

const pdfFileFilter = (req, file, callback) => {
  if (PDF_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(
    createUploadError(
      "Only PDF files are allowed.",
      "INVALID_PDF_TYPE",
    ),
    false,
  );
};

// ==================== Create Image Upload ====================

const createImageUpload = (filesLimit = DEFAULT_IMAGE_FILE_LIMIT) => {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: MAX_IMAGE_SIZE,
      files: filesLimit,
    },
  });
};

// ==================== Create Document Upload ====================

const createDocumentUpload = (filesLimit = DEFAULT_DOCUMENT_FILE_LIMIT) => {
  return multer({
    storage: memoryStorage,
    fileFilter: documentFileFilter,
    limits: {
      fileSize: MAX_DOCUMENT_SIZE,
      files: filesLimit,
    },
  });
};

// ==================== Create Company Profile Upload ====================

const createCompanyProfileUpload = () => {
  return multer({
    storage: memoryStorage,
    fileFilter: pdfFileFilter,
    limits: {
      fileSize: MAX_COMPANY_PROFILE_SIZE,
      files: 1,
    },
  });
};

// ==================== Image Upload Configurations ====================

const imageUpload = createImageUpload(DEFAULT_IMAGE_FILE_LIMIT);

const projectImageUpload = createImageUpload(PROJECT_IMAGE_FILE_LIMIT);

// ==================== Document Upload Configurations ====================

const documentUpload = createDocumentUpload(DEFAULT_DOCUMENT_FILE_LIMIT);

const singleDocumentUpload = createDocumentUpload(1);

const companyProfileUpload = createCompanyProfileUpload();

// ==================== Upload Single Image ====================

const uploadSingle = (fieldName) => {
  return imageUpload.single(fieldName);
};

// ==================== Upload Image Array ====================

const uploadArray = (fieldName, maxCount = 10) => {
  return createImageUpload(maxCount).array(fieldName, maxCount);
};

// ==================== Upload Image Fields ====================

const uploadFields = (fields) => {
  const totalFiles = fields.reduce(
    (total, field) => total + (field.maxCount || 1),
    0,
  );

  return createImageUpload(totalFiles).fields(fields);
};

// ==================== Upload Single Document ====================

const uploadSingleDocument = (fieldName) => {
  return singleDocumentUpload.single(fieldName);
};

// ==================== Upload Document Array ====================

const uploadDocumentArray = (fieldName, maxCount = 5) => {
  return createDocumentUpload(maxCount).array(fieldName, maxCount);
};

// ==================== Upload Document Fields ====================

const uploadDocumentFields = (fields) => {
  const totalFiles = fields.reduce(
    (total, field) => total + (field.maxCount || 1),
    0,
  );

  return createDocumentUpload(totalFiles).fields(fields);
};

// ==================== Partner Logo Upload ====================

const uploadPartnerLogo = () => {
  return createImageUpload(1).single("logo");
};

// ==================== Journey Image Upload ====================

const uploadJourneyImage = () => {
  return createImageUpload(1).single("image");
};

// ==================== News Image Upload ====================

const uploadNewsImage = () => {
  return createImageUpload(1).single("image");
};

// ==================== Team Member Image Upload ====================

const uploadTeamMemberImage = () => {
  return createImageUpload(1).single("image");
};

// ==================== Service Images Upload ====================

const uploadServiceImages = () => {
  return createImageUpload(2).fields([
    {
      name: "cardImage",
      maxCount: 1,
    },
    {
      name: "heroImage",
      maxCount: 1,
    },
  ]);
};

// ==================== Project Images Upload ====================

const uploadProjectImages = () => {
  return projectImageUpload.fields([
    {
      name: "cardImage",
      maxCount: 1,
    },
    {
      name: "heroImage",
      maxCount: 1,
    },
    {
      name: "gallery",
      maxCount: 20,
    },
    {
      name: "certificateImages",
      maxCount: 10,
    },
  ]);
};

// ==================== Equipment Image Upload ====================

const uploadEquipmentImage = () => {
  return createImageUpload(1).single("image");
};

// ==================== User Avatar Upload ====================

const uploadUserAvatar = () => {
  return createImageUpload(1).single("avatar");
};

// ==================== Resume Upload ====================

const uploadResume = () => {
  return singleDocumentUpload.single("resume");
};

// ==================== Job Request CV Upload ====================

const uploadJobRequestCv = () => {
  return singleDocumentUpload.single("cv");
};

// ==================== Certificate Upload ====================

const uploadCertificate = () => {
  return singleDocumentUpload.single("certificate");
};

// ==================== Company Profile Upload ====================

const uploadCompanyProfile = () => {
  return companyProfileUpload.single("file");
};

// ==================== Exports ====================

module.exports = {
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE,
  MAX_COMPANY_PROFILE_SIZE,

  DEFAULT_IMAGE_FILE_LIMIT,
  DEFAULT_DOCUMENT_FILE_LIMIT,
  PROJECT_IMAGE_FILE_LIMIT,

  DOCUMENT_MIME_TYPES,
  PDF_MIME_TYPES,

  createUploadError,

  imageFileFilter,
  documentFileFilter,
  pdfFileFilter,

  createImageUpload,
  createDocumentUpload,
  createCompanyProfileUpload,

  uploadSingle,
  uploadArray,
  uploadFields,

  uploadSingleDocument,
  uploadDocumentArray,
  uploadDocumentFields,

  uploadPartnerLogo,
  uploadJourneyImage,
  uploadNewsImage,
  uploadTeamMemberImage,
  uploadServiceImages,
  uploadProjectImages,
  uploadEquipmentImage,
  uploadUserAvatar,

  uploadResume,
  uploadJobRequestCv,
  uploadCertificate,
  uploadCompanyProfile,
};