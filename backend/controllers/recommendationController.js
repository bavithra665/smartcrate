const recommendationService = require('../services/recommendationService');
const prisma = require('../config/prisma');
const { toApiRecord } = require('../utils/apiRecord');

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
    const rec = await prisma.recommendation.findFirst({
      where: { harvestId: req.params.harvestId, farmerId: req.farmer.id },
      orderBy: { generatedAt: 'desc' },
      include: { bestMarket: true },
    });
    if (!rec) return res.status(404).json({ message: 'No recommendation found' });
    const { bestMarket, ...record } = rec;
    res.json({ ...toApiRecord(record), bestMarketId: toApiRecord(bestMarket) });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateRecommendation, getLatestRecommendation };
