process.env.NODE_ENV = 'test';

jest.mock('../config/prisma', () => ({
  recommendation: { create: jest.fn() },
  prediction: { findFirst: jest.fn() },
  harvest: { findFirst: jest.fn() },
  market: { findMany: jest.fn() },
  marketPrice: { findFirst: jest.fn() },
}));

const prisma = require('../config/prisma');
const recommendationService = require('../services/recommendationService');
const { evaluateDecision } = require('../services/decisionEngine');

const farmerId = '507f1f77bcf86cd799439011';
const otherFarmerId = '507f1f77bcf86cd799439099';
const harvestId = '507f1f77bcf86cd799439012';

beforeEach(() => {
  jest.clearAllMocks();
});

test('rejects a harvest that belongs to another farmer', async () => {
  prisma.harvest.findFirst.mockResolvedValue(null);

  await expect(recommendationService.generate(harvestId, farmerId))
    .rejects.toThrow('Harvest not found');

  expect(prisma.harvest.findFirst).toHaveBeenCalledWith({ where: { id: harvestId, farmerId } });
  expect(prisma.prediction.findFirst).not.toHaveBeenCalled();
  expect(prisma.harvest.findFirst).not.toHaveBeenCalledWith({ where: { id: harvestId, farmerId: otherFarmerId } });
});

test('scores net value after transport cost and explains the decision', async () => {
  const localMarket = {
    id: '507f1f77bcf86cd799439021',
    name: 'Local Market',
    distance: 5,
    travelTime: '15 mins',
    travelTimeHours: 0.25,
    transportCost: 0,
    isActive: true,
  };
  const distantMarket = {
    id: '507f1f77bcf86cd799439022',
    name: 'Distant Market',
    distance: 50,
    travelTime: '2 hrs',
    travelTimeHours: 2,
    transportCost: 1000,
    isActive: true,
  };

  prisma.harvest.findFirst.mockResolvedValue({
    id: harvestId,
    farmerId,
    crop: 'Tomato',
    quantity: 100,
  });
  prisma.prediction.findFirst.mockResolvedValue({
    id: '507f1f77bcf86cd799439031',
    harvestId,
    farmerId,
    remainingShelfLife: 5,
    spoilageRisk: 'Low',
  });
  prisma.market.findMany.mockResolvedValue([localMarket, distantMarket]);
  prisma.marketPrice.findFirst.mockImplementation(async ({ where: { marketId } }) => ({
    modalPrice: marketId === localMarket.id ? 12 : 20,
    unit: 'kg',
    observedAt: new Date(),
    source: 'api',
  }));
  prisma.recommendation.create.mockImplementation(async ({ data }) => ({ id: 'recommendation-1', ...data }));

  const recommendation = await recommendationService.generate(harvestId, farmerId);

  expect(recommendation.action).toBe('Sell Today');
  expect(recommendation.bestMarketId).toBe(localMarket.id);
  expect(recommendation.marketsConsidered[0].netValue).toBe(1200);
  expect(recommendation.marketsConsidered[1].netValue).toBe(1000);
  expect(recommendation.reasons).toEqual(expect.arrayContaining([
    'Minimal transport cost',
  ]));
  expect(prisma.recommendation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    harvestId,
    farmerId,
    action: 'Sell_Today',
    marketsConsidered: expect.any(Array),
  }) });
});

test('does not use legacy shelf-life values without model provenance', () => {
  const result = evaluateDecision({
    harvest: { quantity: 100, unit: 'kg' },
    prediction: { spoilageRisk: 'Low', remainingShelfLife: 7 },
    markets: [],
  });

  expect(result.shelfLife).toEqual({ available: false, remainingDays: null });
  expect(result.reasons).toContain('Remaining shelf-life prediction is unavailable.');
});

test('does not treat fresh mock market prices as actionable data', () => {
  const result = evaluateDecision({
    harvest: { quantity: 100, unit: 'kg' },
    prediction: { spoilageRisk: 'Low' },
    markets: [{
      market: { _id: 'market-1', name: 'Sample Market', distance: 3, transportCost: 0 },
      price: { price: 20, unit: 'kg', observedAt: new Date(), source: 'mock' },
    }],
  });

  expect(result.decision).toBe('INSUFFICIENT_DATA');
  expect(result.markets[0].priceFresh).toBe(false);
  expect(result.markets[0].source).toBe('mock');
  expect(result.markets[0].grossValue).toBeNull();
  expect(result.markets[0].netValue).toBeNull();
  expect(result.reasons).toContain('Sample Market uses development/sample market data and was not used for the decision.');
});
