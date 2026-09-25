const SensorReading = require('../models/SensorReading');
const Harvest = require('../models/Harvest');
const predictionService = require('../services/predictionService');
const { calculateHoursSinceHarvest } = predictionService;
const notificationService = require('../services/notificationService');

/**
 * POST /api/sensors/readings
 * Accepts readings from ESP32 hardware OR the dev simulator.
 * After saving, triggers ML prediction automatically.
 */
const createReading = async (req, res, next) => {
  try {
    const { harvestId, temperature, humidity, ethylene, voc, co2, currentWeight, deviceId } = req.body;

    // Verify harvest belongs to this farmer (or allow ESP32 with harvestId directly)
    const harvest = await Harvest.findById(harvestId);
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    const observationTimestamp = new Date();
    try {
      calculateHoursSinceHarvest(harvest, observationTimestamp);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const source = deviceId ? 'esp32' : (process.env.NODE_ENV === 'development' ? 'simulator' : 'manual');

    const reading = await SensorReading.create({
      harvestId,
      farmerId: harvest.farmerId,
      temperature, humidity, ethylene, voc, co2, currentWeight,
      source,
      deviceId,
      timestamp: observationTimestamp,
    });

    // Trigger prediction asynchronously (don't block the sensor response)
    predictionService.runPrediction(harvest, reading, { observationTimestamp })
      .catch((error) => console.error('[SensorController] Prediction generation failed:', error.message));

    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
};

// GET /api/sensors/readings/:harvestId  — latest reading
const getLatestReading = async (req, res, next) => {
  try {
    const reading = await SensorReading.findOne({ harvestId: req.params.harvestId })
      .sort({ timestamp: -1 });
    if (!reading) return res.status(404).json({ message: 'No sensor readings found' });
    res.json(reading);
  } catch (err) {
    next(err);
  }
};

// GET /api/sensors/history/:harvestId  — all readings for a harvest
const getReadingHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const readings = await SensorReading.find({ harvestId: req.params.harvestId })
      .sort({ timestamp: -1 })
      .limit(limit);
    res.json(readings);
  } catch (err) {
    next(err);
  }
};

module.exports = { createReading, getLatestReading, getReadingHistory };
