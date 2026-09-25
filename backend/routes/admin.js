const express = require('express');
const router = express.Router();
const { getStats, getAllFarmers, getAllHarvests, getFeedbackSummary } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.get('/stats', getStats);
router.get('/farmers', getAllFarmers);
router.get('/harvests', getAllHarvests);
router.get('/feedback-summary', getFeedbackSummary);

module.exports = router;
