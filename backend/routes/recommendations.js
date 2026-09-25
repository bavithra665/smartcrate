const express = require('express');
const router = express.Router();
const { generateRecommendation, getLatestRecommendation } = require('../controllers/recommendationController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
	recommendationGenerateValidators,
	recommendationHarvestValidators,
} = require('../validators/requestValidators');

router.use(protect);
router.post('/generate', recommendationGenerateValidators, validate, generateRecommendation);
router.get('/:harvestId/latest', recommendationHarvestValidators, validate, getLatestRecommendation);

module.exports = router;
