const express = require('express');
const router = express.Router();
const { getLatestPrediction, getPredictionHistory } = require('../controllers/predictionController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { recommendationHarvestValidators } = require('../validators/requestValidators');

router.use(protect);
router.get('/:harvestId/latest', recommendationHarvestValidators, validate, getLatestPrediction);
router.get('/:harvestId/history', recommendationHarvestValidators, validate, getPredictionHistory);

module.exports = router;
