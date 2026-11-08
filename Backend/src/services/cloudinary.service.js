const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const cloudinary = require("../config/cloudinary");
const Job = require("../models/maintenanceJob.model");
const { queueImageDeletion } = require("./maintenance.service");

const uploadImage = async (file, folder = "sinuora") => {
  if (!file?.buffer) throw Object.assign(new Error("Image file is required"), { statusCode: 400 });
  // Persist a deterministic identity before contacting remote storage. Abandoned
  // uploads are recoverable even if the process exits before receiving a response.
  const publicId = `${folder}/${randomUUID()}`;
  await new Job({ kind: "image", publicId, state: "staged", availableAt: new Date(Date.now() + 3600000) }).save();
  try {
    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "image", timeout: 60000 }, (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.end(file.buffer);
    });
  } catch (error) {
    await queueImageDeletion(publicId);
    throw error;
  }
};
const discardImages = async images => {
  for (const image of images) await queueImageDeletion(image.publicId);
};
const uploadImages = async (files = [], folder = "sinuora/products") => {
  const images = [];
  try {
    for (const file of files) images.push(await uploadImage(file, folder));
    return images;
  } catch (error) {
    await discardImages(images);
    throw error;
  }
};
const saveWithImages = async (document, uploaded = [], removed = []) => {
  try {
    // Mongoose's transaction wrapper resets document save state on retry.
    await mongoose.connection.transaction(async session => {
      await document.save({ session });
      for (const image of uploaded) {
        const result = await Job.updateOne({ publicId: image.publicId, state: "staged" }, { $set: { state: "attached" } }, { session });
        if (!result.matchedCount) throw Object.assign(new Error("Upload expired; upload the image again"), { statusCode: 409 });
      }
      for (const publicId of removed.filter(Boolean)) await queueImageDeletion(publicId, session);
    });
    document.$session(null);
    return document;
  } catch (error) {
    await discardImages(uploaded);
    throw error;
  }
};
module.exports = { uploadImage, uploadImages, discardImages, saveWithImages, deleteImage: queueImageDeletion };
