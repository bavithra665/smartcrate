const express = require('express');
const router = express.Router();
const { createReading, getLatestReading, getReadingHistory } = require('../controllers/sensorController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
	sensorReadingValidators,
	sensorHarvestValidators,
} = require('../validators/requestValidators');

// ESP32 posts to this endpoint directly (no auth token needed from hardware)
// In production, secure this with a device API key instead
router.post('/readings', sensorReadingValidators, validate, createReading);

router.get('/readings/:harvestId', protect, sensorHarvestValidators, validate, getLatestReading);
router.get('/history/:harvestId', protect, sensorHarvestValidators, validate, getReadingHistory);

module.exports = router;
