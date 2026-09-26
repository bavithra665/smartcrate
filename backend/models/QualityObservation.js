const mongoose = require('mongoose');

const qualityObservationSchema = new mongoose.Schema({
  harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  qualityGrade: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'],
    default: 'Unknown',
  },
  saleabilityStatus: {
    type: String,
    enum: ['SALEABLE', 'BORDERLINE', 'NOT_SALEABLE', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  visibleSpoilage: {
    type: String,
    enum: ['NONE', 'PARTIAL', 'SEVERE', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  firmness: { type: String },
  colorRipeness: { type: String },
  odorNote: { type: String },
  observerSource: {
    type: String,
    enum: ['farmer', 'field_agent', 'device', 'manual', 'other'],
    default: 'farmer',
  },
  labelConfidence: {
    type: String,
    enum: ['confirmed', 'probable', 'uncertain'],
    default: 'confirmed',
  },
  observedAt: { type: Date, required: true },
  isEndOfSaleableLife: { type: Boolean, default: false },
  endOfSaleableLifeTimestamp: { type: Date },
  comments: { type: String },
}, { timestamps: true });

qualityObservationSchema.index({ harvestId: 1, observedAt: -1 });
qualityObservationSchema.index({ harvestId: 1, observedAt: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('QualityObservation', qualityObservationSchema);
