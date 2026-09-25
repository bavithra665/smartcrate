const Harvest = require('../models/Harvest');
const Prediction = require('../models/Prediction');
const Recommendation = require('../models/Recommendation');
const FarmerFeedback = require('../models/FarmerFeedback');

const normalizeFeedbackPayload = (body) => {
  const output = {};
  const keys = [
    'harvestId', 'predictionId', 'recommendationId', 'farmerAction', 'actualSaleStatus',
    'actualSellingPrice', 'actualMarket', 'soldQuantity', 'spoiledQuantity',
    'actualSpoilageOutcome', 'actualQuality', 'recommendationHelpful',
    'recommendationFollowed', 'predictionAccurate', 'observedAt', 'comments',
  ];

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key];
      if (key === 'actualSellingPrice' || key === 'soldQuantity' || key === 'spoiledQuantity') {
        output[key] = value === null || value === '' ? undefined : Number(value);
        return;
      }
      if (key === 'recommendationHelpful' || key === 'recommendationFollowed' || key === 'predictionAccurate') {
        output[key] = value === null || value === '' ? undefined : Boolean(value);
        return;
      }
      if (key === 'observedAt') {
        output[key] = value ? new Date(value) : undefined;
        return;
      }
      output[key] = value;
    }
  });

  return output;
};

// POST /api/feedback
const submitFeedback = async (req, res, next) => {
  try {
    const { harvestId, predictionId, recommendationId, observedAt } = req.body;
    const harvest = await Harvest.findOne({ _id: harvestId, farmerId: req.farmer._id });
    if (!harvest) {
      return res.status(404).json({ message: 'Harvest not found' });
    }

    if (predictionId) {
      const prediction = await Prediction.findOne({ _id: predictionId, farmerId: req.farmer._id, harvestId });
      if (!prediction) {
        return res.status(400).json({ message: 'Prediction does not belong to this harvest and farmer' });
      }
    }

    if (recommendationId) {
      const recommendation = await Recommendation.findOne({ _id: recommendationId, farmerId: req.farmer._id, harvestId });
      if (!recommendation) {
        return res.status(400).json({ message: 'Recommendation does not belong to this harvest and farmer' });
      }
    }

    if (observedAt) {
      const observedDate = new Date(observedAt);
      if (Number.isNaN(observedDate.getTime()) || observedDate > new Date()) {
        return res.status(400).json({ message: 'observedAt must be a valid timestamp in the past' });
      }
    }

    const soldQuantity = req.body.soldQuantity != null ? Number(req.body.soldQuantity) : undefined;
    const spoiledQuantity = req.body.spoiledQuantity != null ? Number(req.body.spoiledQuantity) : undefined;
    if ((soldQuantity !== undefined && soldQuantity < 0) || (spoiledQuantity !== undefined && spoiledQuantity < 0)) {
      return res.status(400).json({ message: 'soldQuantity and spoiledQuantity must be non-negative' });
    }
    if (soldQuantity !== undefined && spoiledQuantity !== undefined && soldQuantity + spoiledQuantity > harvest.quantity) {
      return res.status(400).json({ message: 'soldQuantity and spoiledQuantity cannot exceed the total harvest quantity' });
    }

    const payload = normalizeFeedbackPayload(req.body);
    const feedback = await FarmerFeedback.create({
      ...payload,
      farmerId: req.farmer._id,
      harvestId,
      predictionId: payload.predictionId || undefined,
      recommendationId: payload.recommendationId || undefined,
    });

    res.status(201).json(feedback);
  } catch (err) {
    next(err);
  }
};

// GET /api/feedback  (farmer's own feedback)
const getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await FarmerFeedback.find({ farmerId: req.farmer._id })
      .sort({ submittedAt: -1 });
    res.json(feedback);
  } catch (err) {
    next(err);
  }
};

module.exports = { submitFeedback, getMyFeedback };
