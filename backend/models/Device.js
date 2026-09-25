const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, trim: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  apiKeyHash: { type: String, required: true, select: false },
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date },
}, { timestamps: true });

deviceSchema.index({ deviceId: 1, isActive: 1 });

deviceSchema.methods.touch = function touch() {
  this.lastSeenAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Device', deviceSchema);
