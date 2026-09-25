const mongoose = require('mongoose');

const farmerFeedbackSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  harvestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Harvest', required: true },
  predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction' },
  recommendationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' },

  // What the farmer actually did
  farmerAction: { type: String },
  actualSaleStatus: {
    type: String,
    enum: ['Sold', 'Not Sold', 'Spoiled', 'Stored', 'Discarded', 'Not Reported'],
    default: 'Not Reported',
  },
  actualSellingPrice: { type: Number },
  actualMarket: { type: String },
  soldQuantity: { type: Number, min: 0 },
  spoiledQuantity: { type: Number, min: 0 },
  actualSpoilageOutcome: {
    type: String,
    enum: ['No Spoilage', 'Partial Spoilage', 'Full Spoilage', 'Not Reported'],
    default: 'Not Reported',
  },
  actualQuality: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Not Reported'],
    default: 'Not Reported',
  },

  // Was the recommendation helpful?
  recommendationHelpful: { type: Boolean },
  recommendationFollowed: { type: Boolean },
  predictionAccurate: { type: Boolean },
  observedAt: { type: Date, default: Date.now },
  comments: { type: String },

  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('FarmerFeedback', farmerFeedbackSchema);
