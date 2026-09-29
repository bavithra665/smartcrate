const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords } = require('../utils/apiRecord');

// GET /api/predictions/:harvestId/latest
const getLatestPrediction = async (req, res, next) => {
  try {
    const prediction = await prisma.prediction.findFirst({
      where: { harvestId: req.params.harvestId, farmerId: req.farmer.id },
      orderBy: { predictedAt: 'desc' },
    });
    if (!prediction) return res.status(404).json({ message: 'No prediction found for this harvest' });
    res.json(toApiRecord(prediction));
  } catch (err) {
    next(err);
  }
};

// GET /api/predictions/:harvestId/history
const getPredictionHistory = async (req, res, next) => {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { harvestId: req.params.harvestId, farmerId: req.farmer.id },
      orderBy: { predictedAt: 'desc' },
      take: 20,
    });
    res.json(toApiRecords(predictions));
  } catch (err) {
    next(err);
  }
};

module.exports = { getLatestPrediction, getPredictionHistory };
