const Recommendation = require('../models/Recommendation');
const Prediction = require('../models/Prediction');
const Harvest = require('../models/Harvest');
const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');

/**
 * Generates a selling recommendation for a harvest.
 * Uses the latest prediction + current market prices.
 */
const generate = async (harvestId, farmerId) => {
  const harvest = await Harvest.findOne({ _id: harvestId, farmerId });
  if (!harvest) throw new Error('Harvest not found');

  const prediction = await Prediction.findOne({ harvestId, farmerId }).sort({ predictedAt: -1 });
  if (!prediction) throw new Error('No prediction available. Add sensor data first.');

  const markets = await Market.find({ isActive: true });

  // Get latest price for this crop in each market
  const marketData = await Promise.all(
    markets.map(async (market) => {
      const priceDoc = await MarketPrice.findOne({ marketId: market._id, crop: harvest.crop })
        .sort({ date: -1 });
      const pricePerKg = priceDoc?.modalPrice || null;
      return { market, pricePerKg };
    })
  );

  // Filter out markets with no price data
  const marketsWithPrices = marketData.filter(m => m.pricePerKg !== null);

  const shelfLife = prediction.remainingShelfLife;
  const risk = prediction.spoilageRisk;
  const qty = harvest.quantity;

  // Score each market
  const scored = marketsWithPrices.map(({ market, pricePerKg }) => {
    const grossValue = pricePerKg * qty;
    // Transport cost placeholder — ideally stored per market or calculated by distance
    const transportCost = market.transportCost || 0;
    const netValue = grossValue - transportCost;
    const distance = market.distance || 0;
    const travelHours = market.travelTimeHours || 0.5;
    const safeToTravel = shelfLife > travelHours / 24 + 1;

    let score = netValue;
    if (!safeToTravel) score -= 10000;
    if (risk === 'High' && distance > 30) score -= 5000;

    return {
      marketId: market._id,
      marketName: market.name,
      distance,
      travelTime: market.travelTime || '',
      pricePerKg,
      transportCost,
      grossValue,
      netValue,
      safeToTravel,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  let action, reasons;

  if (risk === 'High') {
    action = 'Sell Today';
    reasons = [
      'High spoilage risk detected',
      'Immediate sale is recommended to avoid losses',
      best ? `Nearest available market: ${best.marketName}` : 'Sell at the nearest available market',
    ];
  } else if (!best) {
    action = 'Sell Today';
    reasons = ['No market price data available — sell at nearest market'];
  } else if (best.distance <= 10) {
    action = 'Sell Today';
    reasons = [
      `Local market offers ₹${best.pricePerKg}/kg`,
      'Minimal transport cost',
      'Produce is ready for sale',
    ];
  } else if (shelfLife >= 3 && scored.length > 1 && best.netValue > scored[scored.length - 1].netValue * 1.1) {
    action = 'Transport to Another Market';
    reasons = [
      `${best.marketName} offers a higher net value of ₹${best.netValue.toLocaleString('en-IN')}`,
      `Current price: ₹${best.pricePerKg}/kg`,
      `Produce has ${shelfLife} days of remaining shelf life`,
      'Travel time is within the safe selling window',
    ];
  } else if (shelfLife >= 5 && risk === 'Low') {
    action = 'Wait for Better Price';
    reasons = [
      `Produce has ${shelfLife} days of remaining shelf life`,
      'Current market prices are not optimal',
      'Monitor prices for the next 1–2 days',
    ];
  } else {
    action = 'Move Produce to Storage';
    reasons = [
      'Move produce to better storage conditions',
      `Shelf life is ${shelfLife} days — prepare for sale soon`,
      'Ensure proper temperature and humidity',
    ];
  }

  const recommendation = await Recommendation.create({
    harvestId,
    farmerId,
    predictionId: prediction._id,
    action,
    reasons,
    marketsConsidered: scored,
    bestMarketId: best?.marketId || null,
    remainingShelfLife: shelfLife,
    spoilageRisk: risk,
    quantity: qty,
  });

  return recommendation;
};

module.exports = { generate };
