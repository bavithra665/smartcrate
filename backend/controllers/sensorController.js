const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords, toPrismaData } = require('../utils/apiRecord');
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
    const harvest = await prisma.harvest.findUnique({ where: { id: harvestId } });
    if (!harvest) return res.status(404).json({ message: 'Harvest not found' });

    if (req.sensorDevice && String(req.sensorDevice.farmerId) !== String(harvest.farmerId)) {
      return res.status(403).json({ message: 'Device is not authorized for this harvest' });
    }
    if (req.farmer && String(req.farmer.id) !== String(harvest.farmerId)) {
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
      const existing = await prisma.sensorReading.findUnique({
        where: { deviceId_timestamp: readingFilter },
      });
      if (existing) {
        return res.status(200).json({ ...toApiRecord(existing), duplicate: true });
      }
    }

    const reading = await prisma.sensorReading.create({
      data: toPrismaData({
      harvestId: harvest.id,
      farmerId: harvest.farmerId,
      temperature, humidity, ethylene, voc, co2, currentWeight,
      source,
      deviceId,
      timestamp: observationTimestamp,
      }),
    });

    // Trigger prediction asynchronously (don't block the sensor response)
    predictionService.runPrediction(harvest, reading, { observationTimestamp })
      .catch((error) => console.error('[SensorController] Prediction generation failed:', error.message));

    res.status(201).json(toApiRecord(reading));
  } catch (err) {
    next(err);
  }
};

// GET /api/sensors/readings/:harvestId  — latest reading
const getLatestReading = async (req, res, next) => {
  try {
    const reading = await prisma.sensorReading.findFirst({
      where: { harvestId: req.params.harvestId },
      orderBy: { timestamp: 'desc' },
    });
    if (!reading) return res.status(404).json({ message: 'No sensor readings found' });
    res.json(toApiRecord(reading));
  } catch (err) {
    next(err);
  }
};

// GET /api/sensors/history/:harvestId  — all readings for a harvest
const getReadingHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const readings = await prisma.sensorReading.findMany({
      where: { harvestId: req.params.harvestId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    res.json(toApiRecords(readings));
  } catch (err) {
    next(err);
  }
};

module.exports = { createReading, getLatestReading, getReadingHistory };
