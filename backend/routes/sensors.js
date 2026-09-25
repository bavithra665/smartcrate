const express = require('express');
const router = express.Router();
const { createReading, getLatestReading, getReadingHistory } = require('../controllers/sensorController');
const { protect } = require('../middleware/auth');
const { sensorAuth } = require('../middleware/sensorAuth');
const { validate } = require('../middleware/validate');
const {
	sensorReadingValidators,
	sensorHarvestValidators,
} = require('../validators/requestValidators');

// Hardware uses X-Device-Api-Key; the local simulator uses the farmer JWT.
router.post('/readings', sensorReadingValidators, validate, sensorAuth, createReading);

router.get('/readings/:harvestId', protect, sensorHarvestValidators, validate, getLatestReading);
router.get('/history/:harvestId', protect, sensorHarvestValidators, validate, getReadingHistory);

module.exports = router;
