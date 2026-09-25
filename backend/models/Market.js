const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  district: { type: String, trim: true },
  state: { type: String, trim: true },
  marketType: { type: String, enum: ['APMC', 'Local', 'Wholesale', 'Retail', 'Other'], default: 'Local' },
  supportedCrops: [{ type: String, trim: true }],
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isActive: { type: Boolean, default: true },
  distance: { type: Number, default: null },
  travelTime: { type: String },
  travelTimeHours: { type: Number, default: null },
  transportCost: { type: Number, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Market', marketSchema);
