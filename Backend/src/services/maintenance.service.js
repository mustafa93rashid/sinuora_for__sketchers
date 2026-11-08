const Job = require("../models/maintenanceJob.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
let timer;
let running;
const queueImageDeletion = (publicId, session = null) => publicId && Job.updateOne(
  { publicId }, { $set: { kind: "image", state: "pending", availableAt: new Date() } }, { upsert: true, session },
);
const queueSecurityEmail = async (payload, session) => {
  await new Job({ kind: "securityEmail", payload }).save({ session });
};
const processPending = async () => {
  for (let count = 0; count < 20; count++) {
    const job = await Job.findOneAndUpdate({
      state: { $in: ["pending", "staged", "processing"] }, availableAt: { $lte: new Date() },
    }, { $set: { state: "processing", availableAt: new Date(Date.now() + 300000) }, $inc: { attempts: 1 } }, { returnDocument: "after" });
    if (!job) break;
    try {
      if (job.kind === "image") {
        const referenced = await Product.exists({ "images.publicId": job.publicId }) || await User.exists({ "avatar.publicId": job.publicId });
        if (referenced) {
          await Job.updateOne({ _id: job._id, state: "processing" }, { $set: { state: "attached" } });
          continue;
        }
        const result = await require("../config/cloudinary").uploader.destroy(job.publicId, { resource_type: "image", timeout: 60000 });
        if (!["ok", "not found"].includes(result.result)) throw new Error("Image deletion was not confirmed");
      } else {
        await require("./email.service").sendEmail(job.payload);
      }
      await Job.updateOne({ _id: job._id, state: "processing" }, { $set: { state: "done" }, $unset: { payload: 1, lastError: 1 } });
    } catch (error) {
      await Job.updateOne({ _id: job._id, state: "processing" }, { $set: {
        state: "pending", lastError: error.message, availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7))),
      } });
    }
  }
};
const runMaintenance = () => {
  if (!running) running = processPending().finally(() => { running = null; });
  return running;
};
const startMaintenance = () => {
  if (!timer) {
    timer = setInterval(() => runMaintenance().catch(error => console.error("Maintenance failed:", error.message)), 30000);
    timer.unref();
  }
};
const stopMaintenance = async () => { clearInterval(timer); timer = null; if (running) await running; };
module.exports = { queueImageDeletion, queueSecurityEmail, runMaintenance, startMaintenance, stopMaintenance };
