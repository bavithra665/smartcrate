const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');
const { syncMarketPrices } = require('../services/marketService');

const normalizeMarketResponse = (market) => ({
  ...market.toObject ? market.toObject() : market,
  marketId: market._id || market.marketId,
  market: market.name,
});

const executeQuery = async (query, sortObject) => {
  if (query && typeof query.sort === 'function') {
    return query.sort(sortObject);
  }
  return query;
};

const getMarkets = async (req, res, next) => {
  try {
    const marketQuery = Market.find({ isActive: true });
    const markets = await executeQuery(marketQuery, { name: 1 });
    res.json((Array.isArray(markets) ? markets : []).map(normalizeMarketResponse));
  } catch (err) {
    next(err);
  }
};

const getMarketPrices = async (req, res, next) => {
  try {
    const { crop } = req.query;
    const filter = { marketId: req.params.id };
    if (crop) filter.crop = crop;

    const prices = await MarketPrice.find(filter).sort({ observedAt: -1 }).limit(30);
    res.json(prices);
  } catch (err) {
    next(err);
  }
};

const getLatestPricesForCrop = async (req, res, next) => {
  try {
    const { crop } = req.query;
    if (!crop) return res.status(400).json({ message: 'crop query param required' });

    const priceQuery = MarketPrice.find({ crop });
    const prices = await executeQuery(priceQuery, { observedAt: -1 });
    const limitedPrices = Array.isArray(prices) ? prices.slice(0, 30) : (prices && typeof prices.limit === 'function' ? await prices.limit(30) : prices);
    const populated = await MarketPrice.populate(limitedPrices, { path: 'marketId', model: 'Market' });

    res.json((populated || []).map((item) => {
      const plain = item.toObject ? item.toObject() : item;
      return {
        ...plain,
        market: plain.marketId ? plain.marketId.name : null,
        marketName: plain.marketId ? plain.marketId.name : null,
        price: plain.price ?? plain.modalPrice ?? null,
        unit: plain.unit || 'kg',
        currency: plain.currency || 'INR',
        observedAt: plain.observedAt || plain.date || null,
        source: plain.source || 'manual',
      };
    }));
  } catch (err) {
    next(err);
  }
};

const createMarket = async (req, res, next) => {
  try {
    const market = await Market.create(req.body);
    res.status(201).json(market);
  } catch (err) {
    next(err);
  }
};

const addMarketPrice = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      price: req.body.price ?? req.body.modalPrice,
      observedAt: req.body.observedAt || req.body.date || new Date().toISOString(),
      unit: req.body.unit || 'kg',
      currency: req.body.currency || 'INR',
      date: req.body.date || req.body.observedAt || new Date().toISOString(),
    };

    const doc = await MarketPrice.create(payload);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

const compareMarkets = async (req, res, next) => {
  try {
    const { crop, quantity = 100 } = req.query;
    if (!crop) return res.status(400).json({ message: 'crop query param required' });

    const marketQuery = Market.find({ isActive: true });
    const markets = await executeQuery(marketQuery, { name: 1 });
    const results = await Promise.all(
      (Array.isArray(markets) ? markets : []).map(async (market) => {
        const priceQuery = MarketPrice.findOne({ marketId: market._id, crop });
        const priceDoc = await executeQuery(priceQuery, { observedAt: -1 });
        const price = priceDoc?.price ?? null;
        const unit = priceDoc?.unit || 'kg';
        const currency = priceDoc?.currency || 'INR';
        const observedAt = priceDoc?.observedAt || priceDoc?.date || null;
        const distance = market.distance ?? null;
        const travelTime = market.travelTime || null;
        const transportCost = market.transportCost ?? null;
        const grossValue = price !== null && Number(quantity) ? price * Number(quantity) : null;
        const netValue = grossValue !== null && transportCost !== null ? grossValue - transportCost : null;

        return {
          marketId: market._id,
          market: market.name,
          name: market.name,
          location: market.location,
          district: market.district,
          state: market.state,
          distance,
          travelTime,
          transportCost,
          price,
          unit,
          currency,
          observedAt,
          grossValue,
          netValue,
          source: priceDoc?.source || null,
        };
      })
    );

    results.sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return b.price - a.price;
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
};

const syncMarkets = async (req, res, next) => {
  try {
    const payload = await syncMarketPrices({ crop: req.body?.crop, location: req.body?.location });
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

module.exports = { getMarkets, getMarketPrices, getLatestPricesForCrop, createMarket, addMarketPrice, compareMarkets, syncMarkets };
