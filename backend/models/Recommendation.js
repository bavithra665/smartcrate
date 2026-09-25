const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction' },

  action: {
    type: String,
    enum: ['Sell Today', 'Wait for Better Price', 'Transport to Another Market', 'Move Produce to Storage'],
    required: true,
  },
  reasons: [{ type: String }],
  decision: {
    type: String,
    enum: ['SELL_TODAY', 'WAIT', 'MOVE_PRODUCE', 'INSUFFICIENT_DATA'],
  },
  decisionStatus: { type: String, enum: ['actionable', 'insufficient_data'] },
  confidence: { type: Number, default: null },

  // Market comparison snapshot used to generate this recommendation
  marketsConsidered: [{
    marketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market' },
    marketName: String,
    price: Number,
    unit: String,
    normalizedPricePerKg: Number,
    currency: String,
    observedAt: Date,
    priceFresh: Boolean,
    distance: Number,
    distanceKm: Number,
    travelTime: String,
    travelTimeMinutes: Number,
    pricePerKg: Number,
    transportCost: Number,
    grossValue: Number,
    netValue: Number,
    safeToTravel: Boolean,
    availability: String,
  }],

  bestMarketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Market' },

  // Inputs used
  remainingShelfLife: { type: Number },
  spoilageRisk: { type: String },
  quantity: { type: Number },
  shelfLife: {
    available: Boolean,
    remainingDays: Number,
  },
  dataQuality: {
    marketPriceFresh: Boolean,
    transportCostAvailable: Boolean,
    distanceAvailable: Boolean,
    travelTimeAvailable: Boolean,
  },

  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);
