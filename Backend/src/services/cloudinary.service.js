const cloudinary = require("cloudinary").v2;

// ==================== Cloudinary Configuration ====================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==================== Upload Image ====================

const uploadImage = async (file, folder = "sinuora") => {
  if (!file || !file.buffer) {
    const error = new Error("Image file is required");

    error.statusCode = 400;

    throw error;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
};

// ==================== Delete Image ====================

const deleteImage = async (publicId) => {
  if (!publicId) {
    return null;
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });

  return result;
};

// ==================== Replace Image ====================

const replaceImage = async ({
  file,
  oldPublicId,
  folder = "sinuora",
}) => {
  const uploadedImage = await uploadImage(file, folder);

  if (oldPublicId) {
    try {
      await deleteImage(oldPublicId);
    } catch (error) {
      console.error(
        "Failed to delete old Cloudinary image:",
        error.message,
      );
    }
  }

  return uploadedImage;
};

// ==================== Export ====================

module.exports = {
  uploadImage,
  deleteImage,
  replaceImage,
};