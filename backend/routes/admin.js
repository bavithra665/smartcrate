const express = require('express');
const router = express.Router();
const {
	getStats,
	getAllFarmers,
	getAllHarvests,
	getFeedbackSummary,
	getPredictionEvaluation,
	getMlDataReadiness,
	getMlDataPreparation,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.get('/stats', getStats);
router.get('/farmers', getAllFarmers);
router.get('/harvests', getAllHarvests);
router.get('/feedback-summary', getFeedbackSummary);
router.get('/prediction-evaluation', getPredictionEvaluation);
router.get('/ml-data-readiness', getMlDataReadiness);
router.get('/ml-data-preparation', getMlDataPreparation);

module.exports = router;
