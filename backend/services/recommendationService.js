const prisma = require('../config/prisma');
const { toApiRecord, toPrismaData } = require('../utils/apiRecord');
const { evaluateDecision } = require('./decisionEngine');

const legacyAction = {
  SELL_TODAY: 'Sell Today',
  WAIT: 'Wait for Better Price',
  MOVE_PRODUCE: 'Transport to Another Market',
  INSUFFICIENT_DATA: 'Insufficient Data',
};

const latestPrice = async (marketId, crop) => {
  const price = await prisma.marketPrice.findFirst({
    where: { marketId, crop },
    orderBy: { observedAt: 'desc' },
  });
  if (!price) return null;
  const priceData = toApiRecord(price);
  return {
    ...priceData,
    price: priceData.price ?? priceData.modalPrice,
    unit: priceData.unit || 'kg',
    observedAt: priceData.observedAt || priceData.date || new Date(),
  };
};

const generate = async (harvestId, farmerId) => {
  const harvest = await prisma.harvest.findFirst({ where: { id: harvestId, farmerId } });
  if (!harvest) throw new Error('Harvest not found');

  const prediction = await prisma.prediction.findFirst({
    where: { harvestId, farmerId },
    orderBy: { predictedAt: 'desc' },
  });
  if (!prediction) throw new Error('No prediction available. Add sensor data first.');

  const markets = await prisma.market.findMany({ where: { isActive: true } });

  const marketInputs = await Promise.all(markets.map(async (market) => ({
    market: toApiRecord(market),
    price: await latestPrice(market.id, harvest.crop),
  })));
  const decision = evaluateDecision({ harvest, prediction, markets: marketInputs });
  const bestMarket = decision.markets
    .filter((market) => market.priceFresh && market.netValue !== null)
    .sort((left, right) => right.netValue - left.netValue)[0];

  const recommendation = await prisma.recommendation.create({
    data: toPrismaData({
    harvestId,
    farmerId,
    predictionId: prediction.id,
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
    }),
  });

  return {
    ...decision,
    _id: recommendation.id,
    harvestId,
    predictionId: prediction.id,
    action: legacyAction[decision.decision],
    marketsConsidered: decision.markets,
    bestMarketId: bestMarket?.marketId || null,
  };
};

module.exports = { generate };
