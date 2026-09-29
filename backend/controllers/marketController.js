const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords, toPrismaData } = require('../utils/apiRecord');
const { syncMarketPrices } = require('../services/marketService');

const normalizeMarketResponse = (market) => ({
  ...toApiRecord(market),
  marketId: market.id || market.marketId,
  market: market.name,
});

const getMarkets = async (req, res, next) => {
  try {
    const markets = await prisma.market.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
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

    const prices = await prisma.marketPrice.findMany({
      where: filter,
      orderBy: { observedAt: 'desc' },
      take: 30,
    });
    res.json(toApiRecords(prices));
  } catch (err) {
    next(err);
  }
};

const getLatestPricesForCrop = async (req, res, next) => {
  try {
    const { crop } = req.query;
    if (!crop) return res.status(400).json({ message: 'crop query param required' });

    const prices = await prisma.marketPrice.findMany({
      where: { crop },
      orderBy: { observedAt: 'desc' },
      take: 30,
      include: { market: true },
    });

    res.json(prices.map((item) => {
      const { market: joinedMarket, ...priceRecord } = item;
      const plain = toApiRecord(priceRecord);
      const market = toApiRecord(joinedMarket);
      return {
        ...plain,
        marketId: market,
        market: market ? market.name : null,
        marketName: market ? market.name : null,
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
    const market = await prisma.market.create({
      data: toPrismaData({
        name: req.body.name.trim(),
        location: req.body.location.trim(),
        city: req.body.city?.trim(),
        district: req.body.district?.trim(),
        state: req.body.state?.trim(),
        marketType: req.body.marketType,
        isActive: req.body.isActive,
        distance: req.body.distance,
        travelTime: req.body.travelTime?.trim(),
        travelTimeHours: req.body.travelTimeHours,
        transportCost: req.body.transportCost,
        ...(Array.isArray(req.body.supportedCrops) && {
          supportedCrops: req.body.supportedCrops.map((crop) => String(crop).trim()),
        }),
        ...(req.body.coordinates && {
          coordinates: {
            ...(req.body.coordinates.lat !== undefined && {
              lat: req.body.coordinates.lat === null ? null : Number(req.body.coordinates.lat),
            }),
            ...(req.body.coordinates.lng !== undefined && {
              lng: req.body.coordinates.lng === null ? null : Number(req.body.coordinates.lng),
            }),
          },
        }),
        metadata: req.body.metadata || {},
      }),
    });
    res.status(201).json(toApiRecord(market));
  } catch (err) {
    next(err);
  }
};

const addMarketPrice = async (req, res, next) => {
  try {
    const payload = {
      marketId: req.body.marketId,
      crop: req.body.crop.trim(),
      price: req.body.price ?? req.body.modalPrice,
      observedAt: req.body.observedAt || req.body.date || new Date().toISOString(),
      unit: req.body.unit || 'kg',
      currency: req.body.currency || 'INR',
      source: req.body.source,
      variety: req.body.variety?.trim(),
      date: req.body.date || req.body.observedAt || new Date().toISOString(),
      minPrice: req.body.minPrice,
      maxPrice: req.body.maxPrice,
      modalPrice: req.body.modalPrice,
      arrivalQuantity: req.body.arrivalQuantity,
      metadata: req.body.metadata || {},
    };

    const doc = await prisma.marketPrice.create({ data: toPrismaData(payload) });
    res.status(201).json(toApiRecord(doc));
  } catch (err) {
    next(err);
  }
};

const compareMarkets = async (req, res, next) => {
  try {
    const { crop, quantity = 100 } = req.query;
    if (!crop) return res.status(400).json({ message: 'crop query param required' });

    const markets = await prisma.market.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    const results = await Promise.all(
      markets.map(async (market) => {
        const priceDoc = await prisma.marketPrice.findFirst({
          where: { marketId: market.id, crop },
          orderBy: { observedAt: 'desc' },
        });
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
          marketId: market.id,
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
