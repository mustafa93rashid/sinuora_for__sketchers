const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  kind: { type: String, enum: ["image", "securityEmail"], required: true },
  publicId: { type: String },
  state: { type: String, enum: ["staged", "attached", "pending", "processing", "done"], default: "pending" },
  payload: { type: mongoose.Schema.Types.Mixed },
  availableAt: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
  lastError: String,
}, { timestamps: true });
schema.index({ publicId: 1 }, { unique: true, partialFilterExpression: { publicId: { $type: "string" } } });
schema.index({ state: 1, availableAt: 1 });
module.exports = mongoose.model("MaintenanceJob", schema);
