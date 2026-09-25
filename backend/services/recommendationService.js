const Recommendation = require('../models/Recommendation');
const Prediction = require('../models/Prediction');
const Harvest = require('../models/Harvest');
const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');
const { evaluateDecision } = require('./decisionEngine');

const legacyAction = {
  SELL_TODAY: 'Sell Today',
  WAIT: 'Wait for Better Price',
  MOVE_PRODUCE: 'Transport to Another Market',
  INSUFFICIENT_DATA: 'Sell Today',
};

const latestPrice = async (marketId, crop) => {
  const price = await MarketPrice.findOne({ marketId, crop }).sort({ observedAt: -1 });
  if (!price) return null;
  return {
    ...price,
    price: price.price ?? price.modalPrice,
    unit: price.unit || 'kg',
    observedAt: price.observedAt || price.date || new Date(),
  };
};

const generate = async (harvestId, farmerId) => {
  const harvest = await Harvest.findOne({ _id: harvestId, farmerId });
  if (!harvest) throw new Error('Harvest not found');

  const prediction = await Prediction.findOne({ harvestId, farmerId }).sort({ predictedAt: -1 });
  if (!prediction) throw new Error('No prediction available. Add sensor data first.');

  const markets = await Market.find({ isActive: true });

  const marketInputs = await Promise.all(markets.map(async (market) => ({
    market,
    price: await latestPrice(market._id, harvest.crop),
  })));
  const decision = evaluateDecision({ harvest, prediction, markets: marketInputs });
  const bestMarket = decision.markets
    .filter((market) => market.priceFresh && market.netValue !== null)
    .sort((left, right) => right.netValue - left.netValue)[0];

  const recommendation = await Recommendation.create({
    harvestId,
    farmerId,
    predictionId: prediction._id,
    action: legacyAction[decision.decision],
    decision: decision.decision,
    decisionStatus: decision.status,
    confidence: decision.confidence,
    reasons: decision.reasons,
    marketsConsidered: decision.markets.map((market) => ({
      ...market,
      distance: market.distanceKm,
      pricePerKg: market.normalizedPricePerKg,
    })),
    bestMarketId: bestMarket?.marketId || null,
    remainingShelfLife: decision.shelfLife.remainingDays,
    shelfLife: decision.shelfLife,
    spoilageRisk: prediction.spoilageRisk,
    quantity: harvest.quantity,
    dataQuality: decision.dataQuality,
  });

  return {
    ...decision,
    _id: recommendation._id,
    harvestId,
    predictionId: prediction._id,
    action: legacyAction[decision.decision],
    marketsConsidered: decision.markets,
    bestMarketId: bestMarket?.marketId || null,
  };
};

module.exports = { generate };
