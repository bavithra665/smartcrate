const FarmerFeedback = require('../models/FarmerFeedback');

// POST /api/feedback
const submitFeedback = async (req, res, next) => {
  try {
    const {
      harvestId,
      predictionId,
      recommendationId,
      farmerAction,
      actualSellingPrice,
      actualMarket,
      actualSpoilageOutcome,
      recommendationHelpful,
      predictionAccurate,
      comments,
    } = req.body;

    const feedback = await FarmerFeedback.create({
      farmerId: req.farmer._id,
      harvestId,
      predictionId,
      recommendationId,
      farmerAction,
      actualSellingPrice,
      actualMarket,
      actualSpoilageOutcome,
      recommendationHelpful,
      predictionAccurate,
      comments,
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
