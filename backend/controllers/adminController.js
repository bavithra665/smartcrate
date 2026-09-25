const Farmer = require('../models/Farmer');
const Harvest = require('../models/Harvest');
const Prediction = require('../models/Prediction');
const SensorReading = require('../models/SensorReading');
const FarmerFeedback = require('../models/FarmerFeedback');
const MarketPrice = require('../models/MarketPrice');

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [
      totalFarmers,
      activeHarvests,
      totalHarvests,
      totalPredictions,
      totalSensorReadings,
      highRiskCount,
      cropDistribution,
      riskDistribution,
      recentFarmers,
    ] = await Promise.all([
      Farmer.countDocuments({ role: 'farmer' }),
      Harvest.countDocuments({ status: 'Active' }),
      Harvest.countDocuments(),
      Prediction.countDocuments(),
      SensorReading.countDocuments(),
      Prediction.countDocuments({ spoilageRisk: 'High' }),
      Harvest.aggregate([
        { $group: { _id: '$crop', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Prediction.aggregate([
        { $group: { _id: '$spoilageRisk', count: { $sum: 1 } } },
      ]),
      Farmer.find({ role: 'farmer' }).sort({ createdAt: -1 }).limit(5).select('name mobile location createdAt'),
    ]);

    res.json({
      totalFarmers,
      activeHarvests,
      totalHarvests,
      totalPredictions,
      totalSensorReadings,
      highRiskCount,
      cropDistribution: cropDistribution.map(c => ({ crop: c._id, count: c.count })),
      riskDistribution: riskDistribution.map(r => ({ risk: r._id, count: r.count })),
      recentFarmers,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/farmers
const getAllFarmers = async (req, res, next) => {
  try {
    const farmers = await Farmer.find({ role: 'farmer' }).sort({ createdAt: -1 });
    res.json(farmers);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/harvests
const getAllHarvests = async (req, res, next) => {
  try {
    const harvests = await Harvest.find().populate('farmerId', 'name mobile location').sort({ createdAt: -1 });
    res.json(harvests);
  } catch (err) {
    next(err);
  }
};

const getFeedbackSummary = async (req, res, next) => {
  try {
    const [totalFeedback, statusBreakdown, averageSellingPrice] = await Promise.all([
      FarmerFeedback.countDocuments(),
      FarmerFeedback.aggregate([
        { $group: { _id: '$actualSaleStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      FarmerFeedback.aggregate([
        { $match: { actualSellingPrice: { $ne: null, $exists: true } } },
        { $group: { _id: null, avgPrice: { $avg: '$actualSellingPrice' } } },
      ]),
    ]);

    res.json({
      totalFeedback,
      statusBreakdown: statusBreakdown.map((item) => ({ status: item._id || 'Not Reported', count: item.count })),
      averageSellingPrice: averageSellingPrice[0]?.avgPrice ?? null,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats, getAllFarmers, getAllHarvests, getFeedbackSummary };
