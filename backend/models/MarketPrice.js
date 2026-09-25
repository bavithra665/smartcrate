const mongoose = require('mongoose');

const marketPriceSchema = new mongoose.Schema({
  marketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
  crop: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, enum: ['kg', 'quintal', 'tonne'], default: 'kg' },
  currency: { type: String, required: true, default: 'INR', trim: true },
  observedAt: { type: Date, required: true, default: Date.now },
  source: { type: String, default: 'manual', trim: true },
  variety: { type: String, trim: true },
  date: { type: Date },
  minPrice: { type: Number, min: 0 },
  maxPrice: { type: Number, min: 0 },
  modalPrice: { type: Number, min: 0 },
  arrivalQuantity: { type: Number, min: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

marketPriceSchema.index({ marketId: 1, crop: 1, observedAt: -1 });
marketPriceSchema.index({ crop: 1, observedAt: -1 });

module.exports = mongoose.model('MarketPrice', marketPriceSchema);
