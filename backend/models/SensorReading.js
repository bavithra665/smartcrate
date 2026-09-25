const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  temperature: { type: Number },       // °C
  humidity: { type: Number },          // %
  ethylene: { type: Number },          // ppm
  voc: { type: Number },               // ppm
  co2: { type: Number },               // ppm
  currentWeight: { type: Number },     // kg (for weight loss calculation)
  source: {
    type: String,
    enum: ['esp32', 'manual', 'simulator'],
    default: 'manual',
  },
  deviceId: { type: String },          // ESP32 device identifier
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Index for fast queries by harvest and time
sensorReadingSchema.index({ harvestId: 1, timestamp: -1 });
sensorReadingSchema.index({ deviceId: 1, timestamp: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
