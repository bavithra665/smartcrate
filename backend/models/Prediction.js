const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  sensorReadingId: { type: mongoose.Schema.Types.ObjectId, ref: 'SensorReading' },

  // Shelf-life prediction
  remainingShelfLife: { type: Number },   // days
  shelfLifeUnit: { type: String, default: 'days' },
  shelfLifeConfidence: { type: Number },  // 0-1, from ML model
  shelfLifeModelVersion: { type: String },
  shelfLifeModelSource: { type: String },
  shelfLifePredictedAt: { type: Date },

  // Spoilage risk classification
  spoilageRisk: { type: String, enum: ['Low', 'Medium', 'High'] },
  spoilageRiskConfidence: { type: Number }, // 0-1, from ML model

  // Features used for this prediction (snapshot)
  featuresUsed: { type: mongoose.Schema.Types.Mixed },

  // Model info
  modelVersion: { type: String },
  predictedAt: { type: Date, default: Date.now },

  // Source: 'ml_model' when real model is used, 'rule_based' for fallback
  source: {
    type: String,
    enum: ['ml_model', 'rule_based', 'pending'],
    default: 'pending',
  },
}, { timestamps: true });

predictionSchema.index({ harvestId: 1, predictedAt: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
