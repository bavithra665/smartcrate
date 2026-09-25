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
    const {
      harvestId, temperature, humidity, ethylene, voc, co2, currentWeight,
      deviceId, source = 'esp32', observedAt,
    } = req.body;

    // Verify harvest belongs to this farmer (or allow ESP32 with harvestId directly)
    const harvest = await Harvest.findById(harvestId);
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    if (req.sensorDevice && String(req.sensorDevice.farmerId) !== String(harvest.farmerId)) {
      return res.status(403).json({ message: 'Device is not authorized for this harvest' });
    }
    if (req.farmer && String(req.farmer._id) !== String(harvest.farmerId)) {
      return res.status(403).json({ message: 'Farmer is not authorized for this harvest' });
    }

    const observationTimestamp = observedAt ? new Date(observedAt) : new Date();
    if (Number.isNaN(observationTimestamp.getTime())) {
      return res.status(400).json({ message: 'observedAt must be a valid ISO-8601 timestamp' });
    }
    if (observationTimestamp.getTime() > Date.now()) {
      return res.status(400).json({ message: 'observedAt cannot be in the future' });
    }
    try {
      calculateHoursSinceHarvest(harvest, observationTimestamp);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const readingFilter = deviceId && { deviceId, timestamp: observationTimestamp };
    if (readingFilter) {
      const existing = await SensorReading.findOne(readingFilter);
      if (existing) {
        const existingValue = typeof existing.toObject === 'function' ? existing.toObject() : existing;
        return res.status(200).json({ ...existingValue, duplicate: true });
      }
    }

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
