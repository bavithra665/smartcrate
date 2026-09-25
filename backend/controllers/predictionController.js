const Prediction = require('../models/Prediction');

// GET /api/predictions/:harvestId/latest
const getLatestPrediction = async (req, res, next) => {
  try {
    const prediction = await Prediction.findOne({
      harvestId: req.params.harvestId,
      farmerId: req.farmer._id,
    })
      .sort({ predictedAt: -1 });
    if (!prediction) return res.status(404).json({ message: 'No prediction found for this harvest' });
    res.json(prediction);
  } catch (err) {
    next(err);
  }
};

// GET /api/predictions/:harvestId/history
const getPredictionHistory = async (req, res, next) => {
  try {
    const predictions = await Prediction.find({
      harvestId: req.params.harvestId,
      farmerId: req.farmer._id,
    })
      .sort({ predictedAt: -1 })
      .limit(20);
    res.json(predictions);
  } catch (err) {
    next(err);
  }
};

module.exports = { getLatestPrediction, getPredictionHistory };
