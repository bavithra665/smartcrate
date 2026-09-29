const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords } = require('../utils/apiRecord');
const predictionEvaluationService = require('../services/predictionEvaluationService');

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
      prisma.farmer.count({ where: { role: 'farmer' } }),
      prisma.harvest.count({ where: { status: 'Active' } }),
      prisma.harvest.count(),
      prisma.prediction.count(),
      prisma.sensorReading.count(),
      prisma.prediction.count({ where: { spoilageRisk: 'High' } }),
      prisma.harvest.groupBy({
        by: ['crop'],
        _count: { _all: true },
        orderBy: { _count: { crop: 'desc' } },
        take: 10,
      }),
      prisma.prediction.groupBy({ by: ['spoilageRisk'], _count: { _all: true } }),
      prisma.farmer.findMany({
        where: { role: 'farmer' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, mobile: true, location: true, createdAt: true },
      }),
    ]);

    res.json({
      totalFarmers,
      activeHarvests,
      totalHarvests,
      totalPredictions,
      totalSensorReadings,
      highRiskCount,
      cropDistribution: cropDistribution.map((item) => ({ crop: item.crop, count: item._count._all })),
      riskDistribution: riskDistribution.map((item) => ({ risk: item.spoilageRisk, count: item._count._all })),
      recentFarmers: toApiRecords(recentFarmers, { includeVersion: false }),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/farmers
const getAllFarmers = async (req, res, next) => {
  try {
    const farmers = await prisma.farmer.findMany({ where: { role: 'farmer' }, orderBy: { createdAt: 'desc' } });
    res.json(toApiRecords(farmers));
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/harvests
const getAllHarvests = async (req, res, next) => {
  try {
    const harvests = await prisma.harvest.findMany({
      include: { farmer: { select: { id: true, name: true, mobile: true, location: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(harvests.map((harvest) => {
      const { farmer, ...record } = harvest;
      return {
        ...toApiRecord(record),
        farmerId: toApiRecord(farmer, { includeVersion: false }),
      };
    }));
  } catch (err) {
    next(err);
  }
};

const getFeedbackSummary = async (req, res, next) => {
  try {
    const [totalFeedback, statusBreakdown, averageSellingPrice] = await Promise.all([
      prisma.farmerFeedback.count(),
      prisma.farmerFeedback.groupBy({
        by: ['actualSaleStatus'],
        _count: { _all: true },
        orderBy: { _count: { actualSaleStatus: 'desc' } },
      }),
      prisma.farmerFeedback.aggregate({ _avg: { actualSellingPrice: true } }),
    ]);

    res.json({
      totalFeedback,
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.actualSaleStatus === 'Not_Reported'
          ? 'Not Reported'
          : item.actualSaleStatus === 'Not_Sold' ? 'Not Sold' : item.actualSaleStatus,
        count: item._count._all,
      })),
      averageSellingPrice: averageSellingPrice._avg.actualSellingPrice ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/prediction-evaluation
const getPredictionEvaluation = async (req, res, next) => {
  try {
    const evaluation = await predictionEvaluationService.evaluatePredictions();
    res.json({
      ...evaluation,
      records: undefined,
      message: evaluation.status === 'insufficient_data'
        ? 'Insufficient labeled outcomes for reliable evaluation.'
        : 'Evaluation uses explicit farmer-reported spoilage outcomes only.',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/ml-data-readiness
const getMlDataReadiness = async (req, res, next) => {
  try {
    res.json(await predictionEvaluationService.getDataQualityReport());
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/ml-data-preparation
const getMlDataPreparation = async (req, res, next) => {
  try {
    res.json(await predictionEvaluationService.prepareMlData());
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getAllFarmers,
  getAllHarvests,
  getFeedbackSummary,
  getPredictionEvaluation,
  getMlDataReadiness,
  getMlDataPreparation,
};
