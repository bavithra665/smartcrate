const recommendationService = require('../services/recommendationService');
const Recommendation = require('../models/Recommendation');

// POST /api/recommendations/generate
const generateRecommendation = async (req, res, next) => {
  try {
    const { harvestId } = req.body;
    const recommendation = await recommendationService.generate(harvestId, req.farmer._id);
    res.json(recommendation);
  } catch (err) {
    next(err);
  }
};

// GET /api/recommendations/:harvestId/latest
const getLatestRecommendation = async (req, res, next) => {
  try {
    const rec = await Recommendation.findOne({ harvestId: req.params.harvestId })
      .where({ farmerId: req.farmer._id })
      .sort({ generatedAt: -1 })
      .populate('bestMarketId');
    if (!rec) return res.status(404).json({ message: 'No recommendation found' });
    res.json(rec);
  } catch (err) {
    next(err);
  }
};

module.exports = { generateRecommendation, getLatestRecommendation };
