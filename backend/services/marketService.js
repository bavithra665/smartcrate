const Market = require('../models/Market');
const MarketPrice = require('../models/MarketPrice');
const { MarketDataProvider } = require('./marketDataProvider');

const VALID_UNITS = ['kg', 'quintal', 'tonne'];

class MockMarketDataProvider extends MarketDataProvider {
  constructor() {
    super({
      name: 'mock',
      source: 'development/mock-sample-data',
      updateFrequency: 'manual / development only',
      notes: 'Sample market values for local development. Not live market data and not suitable for production decisions.',
    });
  }

  async fetchPrices(crop = 'Tomato', location = 'Erode') {
    const cropName = String(crop || 'Tomato').trim();
    const base = {
      Tomato: 15,
      Onion: 18,
      Banana: 22,
      Potato: 14,
      Carrot: 20,
    };

    const priceValue = Number(base[cropName] ?? 18);
    const sampleMarkets = [
      {
        marketName: 'Erode APMC Market',
        location: 'Erode, Tamil Nadu',
        district: 'Erode',
        state: 'Tamil Nadu',
        crop: cropName,
        price: priceValue,
        unit: 'kg',
        currency: 'INR',
        observedAt: new Date().toISOString(),
        source: 'mock',
        metadata: {
          provider: 'mock',
          sample: true,
          note: 'Sample market data for development only',
        },
      },
      {
        marketName: 'Coimbatore Market',
        location: 'Coimbatore, Tamil Nadu',
        district: 'Coimbatore',
        state: 'Tamil Nadu',
        crop: cropName,
        price: Number((priceValue * 1.18).toFixed(2)),
        unit: 'kg',
        currency: 'INR',
        observedAt: new Date().toISOString(),
        source: 'mock',
        metadata: {
          provider: 'mock',
          sample: true,
          note: 'Sample market data for development only',
        },
      },
    ];

    if (location && location.toLowerCase().includes('coimbatore')) {
      return sampleMarkets.slice(1).concat(sampleMarkets[0]);
    }

    return sampleMarkets;
  }
}

const makeProvider = () => {
  const providerName = (process.env.MARKET_PROVIDER || 'mock').toLowerCase();

  if (providerName === 'mock') {
    return new MockMarketDataProvider();
  }

  throw new Error(`Unsupported market provider: ${providerName}. Configure MARKET_PROVIDER=mock or another supported provider.`);
};

const normalizeUnit = (unit) => {
  const value = String(unit || 'kg').trim().toLowerCase();
  if (!VALID_UNITS.includes(value)) {
    throw new Error(`Unsupported market price unit: ${unit}. Allowed values: ${VALID_UNITS.join(', ')}`);
  }
  return value;
};

const normalizePriceRecord = (record) => {
  const crop = String(record.crop || record.marketCrop || 'Unknown').trim();
  if (!crop) {
    throw new Error('Market crop is required');
  }

  const price = Number(record.price ?? record.modalPrice ?? record.marketPrice ?? record.currentPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid market price for crop ${crop}: ${record.price}`);
  }

  return {
    marketName: String(record.marketName || record.name || 'Unnamed Market').trim(),
    location: String(record.location || record.marketLocation || 'Unknown location').trim(),
    district: record.district || undefined,
    state: record.state || undefined,
    crop,
    price,
    unit: normalizeUnit(record.unit),
    currency: String(record.currency || 'INR').toUpperCase(),
    observedAt: record.observedAt ? new Date(record.observedAt) : new Date(),
    source: String(record.source || 'mock').trim(),
    metadata: record.metadata || {},
  };
};

const syncMarketPrices = async ({ crop, location } = {}) => {
  const provider = makeProvider();
  const records = await provider.fetchPrices(crop, location);

  const normalized = [];
  for (const record of records) {
    const normalizedRecord = normalizePriceRecord({ ...record, crop: record.crop || crop, source: record.source || provider.source });

    let market = await Market.findOne({
      name: normalizedRecord.marketName,
      location: normalizedRecord.location,
    });

    if (!market) {
      market = await Market.create({
        name: normalizedRecord.marketName,
        location: normalizedRecord.location,
        district: normalizedRecord.district,
        state: normalizedRecord.state,
        marketType: 'Local',
        isActive: true,
      });
    }

    const observedAt = normalizedRecord.observedAt;
    const doc = await MarketPrice.findOneAndUpdate(
      {
        marketId: market._id,
        crop: normalizedRecord.crop,
        unit: normalizedRecord.unit,
        observedAt,
      },
      {
        marketId: market._id,
        crop: normalizedRecord.crop,
        price: normalizedRecord.price,
        unit: normalizedRecord.unit,
        currency: normalizedRecord.currency,
        observedAt,
        source: normalizedRecord.source,
        metadata: normalizedRecord.metadata,
        minPrice: normalizedRecord.price,
        maxPrice: normalizedRecord.price,
        modalPrice: normalizedRecord.price,
        date: observedAt,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    normalized.push(doc);
  }

  return {
    provider: provider.name,
    source: provider.source,
    updateFrequency: provider.updateFrequency,
    timestamp: new Date().toISOString(),
    count: normalized.length,
    records: normalized,
  };
};

module.exports = { syncMarketPrices, normalizeUnit, normalizePriceRecord, MockMarketDataProvider };
